import type { CanonicalProgram } from '@tee-backoffice/canonical'
import type { ExportLogger } from '../shared/ExportLogger'
import { ConsoleExportLogger } from '../shared/ConsoleExportLogger'
import type { GristRecord } from '../grist/grist.types'
import { EtalabSchemaValidator } from './EtalabSchemaValidator'
import { GristRowBuilder } from './GristRowBuilder'
import { SchemaExportPolicy } from './SchemaExportPolicy'
import { SchemaFitChecker } from './SchemaFitChecker'
import { SchemaProgramMapper } from './SchemaProgramMapper'
import { SCHEMA_CORE, SCHEMA_ENTREPRISE } from './schema-row.types'
import type { SchemaName, SchemaRow } from './schema-row.types'

/**
 * Single entry point for the Etalab → Grist projection: keeps the exportable
 * dispositifs, maps each to a row and assembles its Grist record. A row is marked
 * fit for a schema only when it is BOTH structurally complete (required columns
 * present) AND Etalab-valid (patterns, formats, lengths) — this is the first
 * validation pass that keeps our own export clean. Whatever fails is reported
 * field by field through the logger (never dropped silently), per the plan's
 * "jamais en silence" rule. The widget runs the same validation again, because
 * rows can also be edited directly in Grist after the export.
 */
export class GristExporter {
  private readonly mapper: SchemaProgramMapper

  constructor(private readonly logger: ExportLogger = new ConsoleExportLogger()) {
    this.mapper = new SchemaProgramMapper(logger)
  }

  exportMany(programs: readonly CanonicalProgram[]): GristRecord[] {
    return programs.filter((program) => SchemaExportPolicy.isExportable(program)).map((program) => this.export(program))
  }

  export(program: CanonicalProgram): GristRecord {
    const row = this.mapper.toRow(program)
    const fittedSchemas = this.resolveFittedSchemas(program, row)
    return GristRowBuilder.build(program, row, fittedSchemas)
  }

  private resolveFittedSchemas(program: CanonicalProgram, row: SchemaRow): SchemaName[] {
    const fitted: SchemaName[] = []
    for (const schema of [SCHEMA_CORE, SCHEMA_ENTREPRISE] as const) {
      const missing = SchemaFitChecker.missingFields(row, schema)
      const invalid = EtalabSchemaValidator.validate(row, schema)
      if (missing.length === 0 && invalid.length === 0) {
        fitted.push(schema)
        continue
      }
      if (missing.length > 0) {
        this.logger.warn(`${program.slug} ne satisfait pas ${schema} (champs manquants : ${missing.join(', ')})`)
      }
      if (invalid.length > 0) {
        this.logger.warn(`${program.slug} invalide pour ${schema} (${invalid.join(' ; ')})`)
      }
    }
    return fitted
  }
}
