import type { ExportLogger } from '../shared/ExportLogger'
import { fullProgram, minimalProgram } from '../__fixtures__/canonical-programs'
import { EtalabSchemaValidator } from './EtalabSchemaValidator'
import { SchemaProgramMapper } from './SchemaProgramMapper'
import { SCHEMA_CORE, SCHEMA_ENTREPRISE } from './schema-row.types'

class SilentLogger implements ExportLogger {
  warn(): void {
    /* swallow warnings in tests */
  }
}

describe('SchemaProgramMapper', () => {
  const mapper = new SchemaProgramMapper(new SilentLogger())

  describe('programme complet (golden row)', () => {
    const row = mapper.toRow(fullProgram)

    it('mappe id (UUID v5 du slug), titre et cibles constantes', () => {
      expect(row.id).toBe('f2b1643e-9f6e-564f-a492-a647575a7617')
      expect(row.titre).toBe('Diagnostic énergie PME')
      expect(row.cibles).toBe('professionnels')
    })

    it('mappe types_aides vers le vocabulaire schéma', () => {
      expect(row.types_aides).toBe('financement|formation')
    })

    it('sérialise les porteurs avec rôles et SIREN', () => {
      expect(JSON.parse(row.porteurs)).toEqual([
        { nom: 'BPIFRANCE', siren: '320252489', roles: ['instructeur', 'diffuseur'] },
        { nom: 'Région Bretagne', roles: ['diffuseur'] },
      ])
    })

    it('mappe géographie, NAF, effectif et exclusions', () => {
      expect(row.eligibilite_geographique).toBe('PAYS-99100')
      expect(row.eligibilite_geographique_exclusions).toBe('REG-94')
      expect(row.ciblage_naf).toBe('C')
      expect(row.ciblage_naf_exclusions).toBe('33.20')
      expect(row.ciblage_secteur_activite).toBe('industrie')
      expect(row.eligibilite_effectif_minimal).toBe('0')
      expect(row.eligibilite_effectif_maximal).toBe('249')
      expect(row.eligibilite_forme_juridique_exclusions).toBe('Microentrepreneur')
    })

    it('valide contre les deux Table Schema Etalab', () => {
      expect(EtalabSchemaValidator.validate(row, SCHEMA_CORE)).toEqual([])
      expect(EtalabSchemaValidator.validate(row, SCHEMA_ENTREPRISE)).toEqual([])
    })
  })

  describe('programme minimal', () => {
    const row = mapper.toRow(minimalProgram)

    it('applique les défauts (national, tous secteurs, url fiche TEE)', () => {
      expect(row.eligibilite_geographique).toBe('PAYS-99100')
      expect(row.ciblage_secteur_activite).toBe("tous secteurs d'activité")
      expect(row.url_source).toBe(
        'https://mission-transition-ecologique.beta.gouv.fr/aides-entreprise/aide-decarbonation-industrie?utm_campaign=openData',
      )
    })

    it('produit une éligibilité non vide et valide contre les deux schémas', () => {
      expect(row.eligibilite).toBe('- Effectif éligible : Toutes tailles')
      expect(EtalabSchemaValidator.validate(row, SCHEMA_CORE)).toEqual([])
      expect(EtalabSchemaValidator.validate(row, SCHEMA_ENTREPRISE)).toEqual([])
    })
  })
})
