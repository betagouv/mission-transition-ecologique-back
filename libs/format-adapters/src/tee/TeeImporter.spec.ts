import { TeeImporter } from './TeeImporter'
import type { TeeRecord } from './TeeImporter'

describe('TeeImporter', () => {
  const importer = new TeeImporter()
  const base: TeeRecord = {
    id: 'aide-test',
    titre: 'Aide test',
    description: 'Description',
    "nature de l'aide": 'financement',
    'opérateur de contact': 'ADEME',
  }

  it('mappe identité et constantes (slug, source, statut)', () => {
    const input = importer.import(base)
    expect(input.slug).toBe('aide-test')
    expect(input.titre).toBe('Aide test')
    expect(input.source).toBe('INTERNE')
    expect(input.statut_edition).toBe('pret_prod')
    expect(input.statut_dispositif).toBe('valide')
    expect(input.types_aides).toEqual(['financement'])
    expect(input.operateurs).toEqual({ contact: { nom: 'ADEME' } })
  })

  describe('contact question', () => {
    it('mailto: → email', () => {
      expect(importer.import({ ...base, 'contact question': 'mailto:a@b.fr' }).contact_question).toEqual({
        type: 'email',
        valeur: 'a@b.fr',
      })
    })
    it('formulaire → conseiller_entreprise', () => {
      expect(importer.import({ ...base, 'contact question': 'formulaire' }).contact_question).toEqual({
        type: 'conseiller_entreprise',
      })
    })
    it('URL brute → url', () => {
      expect(importer.import({ ...base, 'contact question': 'https://x.fr' }).contact_question).toEqual({
        type: 'url',
        valeur: 'https://x.fr',
      })
    })
  })

  it('retire les chevrons d’autolien markdown autour des URL', () => {
    const input = importer.import({
      ...base,
      url: '<https://source.fr>',
      'contact question': '<https://contact.fr>',
      objectifs: [{ description: 'Étape', liens: [{ texte: 'Lien', lien: ' <https://www.opcoep.fr/nous-contacter> ' }] }],
    })
    expect(input.url_source).toBe('https://source.fr')
    expect(input.contact_question).toEqual({ type: 'url', valeur: 'https://contact.fr' })
    expect(input.etapes_activation?.[0]?.liens).toEqual([
      { texte: 'Lien', url: 'https://www.opcoep.fr/nous-contacter' },
    ])
  })

  it('mappe la sentinelle « aide temporairement indisponible »', () => {
    expect(importer.import({ ...base, 'aide temporairement indisponible': 'oui' }).statut_dispositif).toBe(
      'temporairement_indisponible',
    )
  })

  it('classe les clés dynamiques montant vs durée par leur libellé', () => {
    const input = importer.import({
      ...base,
      'montant du financement': 'Jusqu’à 70 %',
      "durée de l'accompagnement": '8 jours',
    })
    expect(input.montant).toEqual({ type: 'montant du financement', valeur: 'Jusqu’à 70 %' })
    expect(input.duree).toEqual({ type: "durée de l'accompagnement", valeur: '8 jours' })
  })

  it('convertit les dates DD/MM/YYYY en ISO', () => {
    const input = importer.import({ ...base, 'début de validité': '01/02/2026', 'fin de validité': '31/12/2026' })
    expect(input.date_ouverture).toBe('2026-02-01')
    expect(input.date_cloture).toBe('2026-12-31')
  })

  describe('catégorie légale', () => {
    const withCompany = (company: Record<string, unknown>) =>
      importer.import({ ...base, eligibilityData: { company } }).eligibilite?.categorie_legale

    it('autorise les administrations publiques quand openToPublicAdministration est vrai', () => {
      expect(withCompany({ openToPublicAdministration: true })).toEqual({
        structure: { autorise: ['administration_publique'] },
      })
    })

    it('cumule l’ouverture aux administrations et l’exclusion des micro-entrepreneurs', () => {
      expect(withCompany({ openToPublicAdministration: true, excludeMicroentrepreneur: true })).toEqual({
        structure: { autorise: ['administration_publique'], interdit: ['micro_entrepreneur'] },
      })
    })

    it('n’émet rien sans drapeau', () => {
      expect(withCompany({ allowedNafSections: ['C'] })).toBeUndefined()
    })
  })

  describe('secteur géographique', () => {
    const withGeo = (allowedRegion: string[] | undefined, texte: string[]) =>
      importer.import({
        ...base,
        "conditions d'éligibilité": { 'secteur géographique': texte },
        ...(allowedRegion ? { eligibilityData: { company: { allowedRegion } } } : {}),
      }).eligibilite?.secteur_geographique

    it('code les régions et les départements de allowedRegion, texte conservé', () => {
      expect(withGeo(['Landes', 'Nouvelle-Aquitaine'], ['Landes, Nouvelle-Aquitaine'])).toEqual({
        texte: ['Landes, Nouvelle-Aquitaine'],
        structure: { inclusions: ['DEP-40', 'REG-75'] },
      })
    })

    it('code la mention nationale en PAYS-99100 faute de allowedRegion', () => {
      expect(withGeo(undefined, ["France et territoires d'outre-mer"])?.structure).toEqual({ inclusions: ['PAYS-99100'] })
    })

    it('suit allowedRegion quand le texte en diffère', () => {
      expect(withGeo(['Bourgogne-Franche-Comté'], ['Jura'])?.structure).toEqual({ inclusions: ['REG-27'] })
    })
  })

  describe('variantes (champs conditionnels)', () => {
    it('reconstruit une condition OR de régions + modifications', () => {
      const input = importer.import({
        ...base,
        'champs conditionnels': [
          {
            'une de ces conditions': ['région = Bretagne', 'région = Normandie'],
            'Montant du dispositif': '1 500 €',
            'autres opérateurs': ['CMA Bretagne'],
          },
        ],
      })
      const variante = input.variantes?.[0]
      expect(variante?.conditions.regions).toEqual(['REG-53', 'REG-28'])
      expect(variante?.modifications.montant).toEqual({ type: 'Montant du dispositif', valeur: '1 500 €' })
      expect(variante?.modifications.operateurs).toEqual({ autres: [{ nom: 'CMA Bretagne' }] })
    })

    it('reconstruit une condition AND d’effectif', () => {
      const input = importer.import({
        ...base,
        // A modification is required for the variant to be kept (schema invariant).
        'champs conditionnels': [
          { 'toutes ces conditions': ['effectif >= 0', 'effectif <= 49'], 'Montant du dispositif': '5 000 €' },
        ],
      })
      expect(input.variantes?.[0].conditions.effectif).toEqual({ min: 0, max: 49 })
    })

    it('code un département cité dans une condition de région', () => {
      const input = importer.import({
        ...base,
        'champs conditionnels': [{ 'une de ces conditions': ['région = Landes'], 'Montant du dispositif': '1 €' }],
      })
      expect(input.variantes?.[0].conditions.regions).toEqual(['DEP-40'])
    })
  })
})
