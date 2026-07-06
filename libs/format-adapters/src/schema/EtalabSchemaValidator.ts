import coreSchema from './etalab/dispositif-aide.schema.json'
import entrepriseSchema from './etalab/dispositif-aide-professionnels.schema.json'
import { SCHEMA_CORE, SCHEMA_ENTREPRISE } from './schema-row.types'
import type { SchemaName, SchemaRow } from './schema-row.types'

interface EtalabField {
  name: string
  type: string
  format?: string
  constraints?: { required?: boolean; maxLength?: number; pattern?: string }
}

interface EtalabTableSchema {
  fields: EtalabField[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates an Etalab `SchemaRow` against the bundled frictionless Table Schema
 * (required, pattern, maxLength, uuid/uri/integer/datetime formats). Lighter
 * than a full frictionless validator but enough to guarantee the projection's
 * patterns (COG, NAF, cibles, ISO dates) hold before publishing.
 */
export class EtalabSchemaValidator {
  private static readonly SCHEMAS: Record<SchemaName, EtalabTableSchema> = {
    [SCHEMA_CORE]: coreSchema as EtalabTableSchema,
    [SCHEMA_ENTREPRISE]: entrepriseSchema as EtalabTableSchema,
  }

  static validate(row: SchemaRow, schema: SchemaName): string[] {
    const errors: string[] = []
    for (const field of EtalabSchemaValidator.SCHEMAS[schema].fields) {
      const value = (row as unknown as Record<string, string | undefined>)[field.name]
      errors.push(...EtalabSchemaValidator.checkField(field, value))
    }
    return errors
  }

  private static checkField(field: EtalabField, value: string | undefined): string[] {
    const errors: string[] = []
    const isEmpty = value === undefined || value.trim().length === 0

    if (field.constraints?.required && isEmpty) {
      errors.push(`${field.name} : requis mais vide`)
    }
    if (isEmpty || value === undefined) return errors

    const { pattern, maxLength } = field.constraints ?? {}
    if (pattern && !new RegExp(pattern).test(value)) errors.push(`${field.name} : ne respecte pas le motif ${pattern}`)
    if (maxLength !== undefined && value.length > maxLength) errors.push(`${field.name} : dépasse ${maxLength} caractères`)
    if (field.format === 'uuid' && !UUID_RE.test(value)) errors.push(`${field.name} : UUID invalide`)
    if (field.format === 'uri' && !/^(https?:\/\/).+/.test(value)) errors.push(`${field.name} : URI invalide`)
    if (field.type === 'integer' && !/^-?\d+$/.test(value)) errors.push(`${field.name} : entier invalide`)
    if (field.type === 'datetime' && Number.isNaN(Date.parse(value))) errors.push(`${field.name} : date invalide`)

    return errors
  }
}
