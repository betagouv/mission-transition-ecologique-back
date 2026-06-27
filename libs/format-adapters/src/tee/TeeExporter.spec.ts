import { TeeExporter } from './TeeExporter'
import { draftProgram, fullProgram, minimalProgram } from '../__fixtures__/canonical-programs'

describe('TeeExporter', () => {
  const exporter = new TeeExporter()

  describe('programme complet', () => {
    const out = exporter.export(fullProgram)

    it('mappe identité et constantes (id = slug, type = tee)', () => {
      expect(out.id).toBe('diagnostic-energie-pme')
      expect(out.type).toBe('tee')
      expect(out.titre).toBe('Diagnostic énergie PME')
      expect(out.metaTitre).toBe('Diagnostic énergie')
      expect(out.illustration).toBe('https://entreprises.ademe.fr/img/diagnostic-energie.jpg')
    })

    it('réduit types_aides au libellé saillant', () => {
      expect(out["nature de l'aide"]).toBe('financement')
    })

    it('replace montant/durée sur leur clé historique (libellé auto-décrit)', () => {
      expect(out['montant du financement']).toBe('Jusqu’à 70 % des dépenses')
      expect(out['durée de l’accompagnement']).toBe('8 jours de formation')
    })

    it('formate le contact et les dates', () => {
      expect(out['contact question']).toBe('mailto:contact@ademe.fr')
      expect(out['début de validité']).toBe('01/01/2026')
      expect(out['fin de validité']).toBe('31/12/2026')
    })

    it('mappe les objectifs et le renvoi formulaire', () => {
      expect(out.objectifs).toEqual([
        {
          description: 'Complétez le formulaire de candidature.',
          liens: [{ lien: 'https://example.org/inscription', texte: 'Inscription' }, { formulaire: true }],
        },
      ])
    })

    it("regroupe effectif + catégorie légale dans « taille de l'entreprise »", () => {
      expect(out["conditions d'éligibilité"]?.["taille de l'entreprise"]).toEqual([
        'Jusqu’à 250 salariés',
        'Hors micro_entrepreneur',
      ])
    })

    it('reconstruit eligibilityData (sections NAF, effectif, micro, régions, thèmes EN)', () => {
      expect(out.eligibilityData?.company.allowedNafSections).toEqual(['C'])
      expect(out.eligibilityData?.company.minEmployees).toBe('0')
      expect(out.eligibilityData?.company.maxEmployees).toBe('249')
      expect(out.eligibilityData?.company.excludeMicroentrepreneur).toBe(true)
      expect(out.eligibilityData?.validity).toEqual({ start: '01/01/2026', end: '31/12/2026' })
      expect(out.eligibilityData?.priorityObjectives).toEqual(['energy', 'building'])
    })

    it('reconstruit champs conditionnels depuis les variantes', () => {
      const champ = out['champs conditionnels']?.[0]
      expect(champ?.['toutes ces conditions']).toEqual(['effectif >= 0', 'effectif <= 49'])
      expect(champ?.['une de ces conditions']).toEqual(['région = Bretagne'])
      expect(champ?.['Montant du dispositif']).toBe('5 400 € HT après subvention de 70 %')
      expect(champ?.["autres critères d'éligibilité"]).toEqual(['CA < 10 M€'])
    })

    it('omet publicodes, activable en autonomie et la sentinelle indisponible quand valide', () => {
      expect(out['publicodes']).toBeUndefined()
      expect(out['activable en autonomie']).toBeUndefined()
      expect(out['aide temporairement indisponible']).toBeUndefined()
    })
  })

  describe('programme minimal', () => {
    const out = exporter.export(minimalProgram)

    it('ne produit que les champs présents', () => {
      expect(out.id).toBe('aide-decarbonation-industrie')
      expect(out["nature de l'aide"]).toBe('financement')
      expect(out.eligibilityData).toBeUndefined()
      expect(out["conditions d'éligibilité"]).toBeUndefined()
      expect(out.objectifs).toBeUndefined()
    })
  })

  describe('filtre de publication', () => {
    it("n'exporte que les programmes publiés", () => {
      const out = exporter.exportMany([fullProgram, draftProgram, minimalProgram])
      expect(out.map((p) => p.id)).toEqual(['diagnostic-energie-pme', 'aide-decarbonation-industrie'])
    })
  })
})
