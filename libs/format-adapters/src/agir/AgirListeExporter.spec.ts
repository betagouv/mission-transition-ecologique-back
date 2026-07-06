import { AgirListeExporter } from './AgirListeExporter'
import {
  archivedProgram,
  draftProgram,
  fullProgram,
  indisponibleProgram,
  minimalProgram,
  remplaceProgram,
} from '../__fixtures__/canonical-programs'

describe('AgirListeExporter', () => {
  const exporter = new AgirListeExporter({ baseUrl: 'https://tee.example.gouv.fr/' })

  describe('entrée complète', () => {
    const out = exporter.export(fullProgram)

    it('mappe identité, source et dates', () => {
      // idDispositif = slug (jamais ademe_id_dsp ni le cuid2).
      expect(out.idDispositif).toBe('diagnostic-energie-pme')
      expect(out.idFonctionnel).toBe('diagnostic-energie-pme')
      expect(out.titre).toBe('Diagnostic énergie PME')
      expect(out.source).toBe('ademe')
      expect(out.dateDispositif).toEqual({ dateDebut: '2026-01-01', dateFin: '2026-12-31' })
      expect(out.dateDerniereModification).toBe('2026-03-19T17:00:00+01:00')
      expect(out.etatDispositif).toBe('en_prod')
    })

    it('construit les 2 URLs depuis la base injectée (sans double slash)', () => {
      expect(out.urlDetail).toBe('https://tee.example.gouv.fr/api/agir/programs/diagnostic-energie-pme/detail')
      expect(out.urlPivot).toBe('https://tee.example.gouv.fr/api/agir/programs/diagnostic-energie-pme/pivot')
    })
  })

  describe('entrée minimale', () => {
    const out = exporter.export(minimalProgram)

    it('utilise le slug comme idDispositif', () => {
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
      remplaceProgram,
    ])

    it('exclut les non-publiés, transmet valide/indisponible/archivé/remplacé', () => {
      const slugs = liste.map((entry) => entry.idFonctionnel)
      // draft (statut_edition en_creation) exclu ; archivé et remplacé transmis.
      expect(slugs).toEqual([
        'aide-decarbonation-industrie',
        'diagnostic-energie-pme',
        'aide-temporairement-indisponible',
        'aide-archivee',
        'aide-remplacee',
      ])
    })

    it('mappe etatDispositif pour chaque statut transmis', () => {
      const etat = (slug: string) => liste.find((entry) => entry.idFonctionnel === slug)?.etatDispositif
      expect(etat('aide-temporairement-indisponible')).toBe('temporairement_indisponible')
      expect(etat('aide-archivee')).toBe('en_prod')
      expect(etat('aide-remplacee')).toBe('remplace')
    })
  })
})
