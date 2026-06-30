import { AgirListeExporter } from './AgirListeExporter'
import {
  archivedProgram,
  draftProgram,
  fullProgram,
  indisponibleProgram,
  minimalProgram,
} from '../__fixtures__/canonical-programs'

describe('AgirListeExporter', () => {
  const exporter = new AgirListeExporter({ baseUrl: 'https://tee.example.gouv.fr/' })

  describe('entrée complète', () => {
    const out = exporter.export(fullProgram)

    it('mappe identité, source et dates', () => {
      // ademe_id_dsp présent dans autres_donnees → idDispositif = DSP.
      expect(out.idDispositif).toBe('DSP-000123')
      expect(out.idFonctionnel).toBe('diagnostic-energie-pme')
      expect(out.titre).toBe('Diagnostic énergie PME')
      expect(out.source).toBe('ademe')
      expect(out.dateDispositif).toEqual({ dateDebut: '2026-01-01', dateFin: '2026-12-31' })
      expect(out.dateDerniereModification).toBe('2026-03-19T17:00:00+01:00')
      expect(out.etatDispositif).toBe('inProd')
    })

    it('construit les 2 URLs depuis la base injectée (sans double slash)', () => {
      expect(out.urlDetail).toBe('https://tee.example.gouv.fr/api/agir/programs/diagnostic-energie-pme/detail')
      expect(out.urlPivot).toBe('https://tee.example.gouv.fr/api/agir/programs/diagnostic-energie-pme/pivot')
    })
  })

  describe('entrée minimale', () => {
    const out = exporter.export(minimalProgram)

    it('retombe sur le slug quand ademe_id_dsp est absent', () => {
      expect(out.idDispositif).toBe('aide-decarbonation-industrie')
    })

    it('mappe la source INTERNE → tee', () => {
      expect(out.source).toBe('tee')
    })

    it('émet dateDispositif vide et omet dateDebut/dateFin sans dates', () => {
      expect(out.dateDispositif).toEqual({})
    })
  })

  describe('filtrage', () => {
    const liste = exporter.exportMany([
      minimalProgram,
      fullProgram,
      draftProgram,
      indisponibleProgram,
      archivedProgram,
    ])

    it('exclut les non-publiés et les statuts non exportables', () => {
      const slugs = liste.map((entry) => entry.idFonctionnel)
      expect(slugs).toEqual([
        'aide-decarbonation-industrie',
        'diagnostic-energie-pme',
        'aide-temporairement-indisponible',
      ])
    })

    it('mappe etatDispositif pour temporairement indisponible', () => {
      const indispo = liste.find((entry) => entry.idFonctionnel === 'aide-temporairement-indisponible')
      expect(indispo?.etatDispositif).toBe('temporairement indisponible')
    })
  })
})
