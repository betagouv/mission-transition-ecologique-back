import type { ExportLogger } from '../shared/ExportLogger'
import type { TechnicalData } from '../grist/grist.types'
import { fullProgram } from '../__fixtures__/canonical-programs'
import { GristRowBuilder } from './GristRowBuilder'
import { SchemaProgramMapper } from './SchemaProgramMapper'
import { SCHEMA_CORE, SCHEMA_ENTREPRISE } from './schema-row.types'

class SilentLogger implements ExportLogger {
  warn(): void {
    /* swallow */
  }
}

describe('GristRowBuilder', () => {
  const row = new SchemaProgramMapper(new SilentLogger()).toRow(fullProgram)
  const record = GristRowBuilder.build(fullProgram, row, [SCHEMA_CORE, SCHEMA_ENTREPRISE])
  const technical = JSON.parse(record.technical) as TechnicalData

  it('ajoute la clé métier slug pour l\'upsert', () => {
    expect(record.slug).toBe('diagnostic-energie-pme')
  })

  it('porte l\'id Etalab sous rnasp_id (évite la collision avec l\'id réservé de Grist)', () => {
    expect(record.rnasp_id).toBe(row.id)
    expect('id' in record).toBe(false)
  })

  it('reprend les colonnes du schéma', () => {
    expect(record.ciblage_secteur_activite).toBe('industrie')
  })

  it('renseigne la colonne technique (source/statut/fitted_schemas)', () => {
    expect(technical.source).toBe('tee')
    expect(technical.statut).toBe('actif')
    expect(technical.fitted_schemas).toEqual([SCHEMA_CORE, SCHEMA_ENTREPRISE])
    expect(technical.date_mise_a_jour).toBe('2026-03-19T17:00:00+01:00')
  })

  it('embarque une copie intégrale du canonical', () => {
    expect(technical.raw_original_data.slug).toBe('diagnostic-energie-pme')
    expect(technical.raw_original_data.autres_donnees?.ademe_id_dsp).toBe('DSP-000123')
  })
})
