import { AgirDetailExporter } from './AgirDetailExporter'
import { fullProgram, minimalProgram } from '../__fixtures__/canonical-programs'

describe('AgirDetailExporter', () => {
  const exporter = new AgirDetailExporter()

  describe('programme complet', () => {
    const out = exporter.export(fullProgram)

    it('mappe identité, source, dates et état', () => {
      expect(out.idDispositif).toBe('DSP-000123')
      expect(out.idFonctionnel).toBe('diagnostic-energie-pme')
      expect(out.titre).toBe('Diagnostic énergie PME')
      expect(out.source).toBe('ademe')
      expect(out.dateDispositif).toEqual({ dateDebut: '2026-01-01', dateFin: '2026-12-31' })
      expect(out.dateDerniereModification).toBe('2026-03-19T17:00:00+01:00')
      expect(out.etatDispositif).toBe('inProd')
    })

    it('dérive typeDispositif des types_aides', () => {
      expect(out.typeDispositif).toBe('financement | formation')
    })

    it('concatène les textes d’éligibilité en puces', () => {
      expect(out.elligibilite?.texteElligibilite).toBe(
        [
          '- Jusqu’à 250 salariés',
          '- Hors micro_entrepreneur',
          '- Industrie',
          '- France métropolitaine',
          '- Plus de 2 ans d’existence',
          '- Être à jour de ses cotisations sociales',
        ].join('\n'),
      )
    })

    it('mappe secteurs activité (NAF) et géographique (COG + typeSecteur)', () => {
      expect(out.elligibilite?.secteurActivite?.listeSecteurActivite).toEqual(['C'])
      expect(out.elligibilite?.secteurGeographique?.listeRegion).toEqual(['PAYS-99100'])
      expect(out.elligibilite?.secteurGeographique?.typeSecteur).toBe('National')
    })

    it('mappe la vignette depuis illustration', () => {
      expect(out.documentation?.vignette).toEqual({
        urlImage: 'https://entreprises.ademe.fr/img/diagnostic-energie.jpg',
        alt: 'Audit énergétique en usine',
      })
    })

    it('mappe la description', () => {
      expect(out.description).toEqual({
        organisme: 'Bpifrance',
        descriptionCourte: 'Un diagnostic financé pour les PME industrielles.',
        descriptionLongue: 'Détail complet du dispositif et des conditions.',
        partenaires: ['Région Bretagne'],
        montantAide: 'Jusqu’à 70 % des dépenses',
        thematique: ['energie', 'batiment'],
        mailContact: 'contact@ademe.fr',
      })
    })

    it('mappe et ordonne etapeDepot avec le premier lien', () => {
      expect(out.etapeDepot).toEqual([
        {
          ordreEtape: 1,
          libelleEtape: 'Complétez le formulaire de candidature.',
          lienEtape: 'https://example.org/inscription',
        },
      ])
    })
  })

  describe('programme minimal', () => {
    const out = exporter.export(minimalProgram)

    it('omet les sections sans source (pas de null/{} parasites)', () => {
      expect(out).not.toHaveProperty('elligibilite')
      expect(out).not.toHaveProperty('documentation')
      expect(out).not.toHaveProperty('etapeDepot')
      expect(out.dateDispositif).toEqual({})
    })

    it('garde une description réduite (organisme + descriptionCourte)', () => {
      expect(out.description).toEqual({
        organisme: 'ADEME',
        descriptionCourte: 'Une **aide** pour réduire vos émissions.',
      })
    })
  })
})
