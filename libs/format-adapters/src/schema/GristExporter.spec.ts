import type { ExportLogger } from '../shared/ExportLogger'
import type { TechnicalData } from '../grist/grist.types'
import {
  archivedProgram,
  draftProgram,
  fullProgram,
  indisponibleProgram,
  minimalProgram,
} from '../__fixtures__/canonical-programs'
import { GristExporter } from './GristExporter'

class SilentLogger implements ExportLogger {
  warn(): void {
    /* swallow */
  }
}

describe('GristExporter', () => {
  const exporter = new GristExporter(new SilentLogger())

  it('exclut les non publiés (draft) et les statuts non exportables (archive)', () => {
    const records = exporter.exportMany([
      minimalProgram,
      fullProgram,
      draftProgram,
      archivedProgram,
      indisponibleProgram,
    ])

    expect(records.map((r) => r.slug)).toEqual([
      'aide-decarbonation-industrie',
      'diagnostic-energie-pme',
      'aide-temporairement-indisponible',
    ])
  })

  it('collapse temporairement_indisponible → indisponible dans la colonne technique', () => {
    const [record] = exporter.exportMany([indisponibleProgram])
    expect((JSON.parse(record?.technical ?? '{}') as TechnicalData).statut).toBe('indisponible')
  })
})
