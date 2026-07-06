import { REQUIRED_FIELDS, SCHEMA_CORE, SCHEMA_ENTREPRISE } from './schema-row.types'
import type { SchemaName, SchemaRow } from './schema-row.types'

/**
 * Decides which Etalab schemas a `SchemaRow` satisfies: a schema fits when all
 * its required columns are non-empty strings. Entreprise extends core, so a row
 * fitting entreprise also fits core. Whatever a row fails to satisfy is reported
 * field by field (never dropped silently) so the CLI recap can explain it.
 */
export class SchemaFitChecker {
  private static readonly SCHEMAS: readonly SchemaName[] = [SCHEMA_CORE, SCHEMA_ENTREPRISE]

  static fittedSchemas(row: SchemaRow): SchemaName[] {
    return SchemaFitChecker.SCHEMAS.filter((schema) => SchemaFitChecker.missingFields(row, schema).length === 0)
  }

  static missingFields(row: SchemaRow, schema: SchemaName): (keyof SchemaRow)[] {
    return REQUIRED_FIELDS[schema].filter((field) => !SchemaFitChecker.isFilled(row[field]))
  }

  private static isFilled(value: string | undefined): boolean {
    return value !== undefined && value.trim().length > 0
  }
}
