import type { CanonicalProgramData } from '@tee-backoffice/canonical'
import type { Statut } from '../shared/StatutMapper'
import type { SchemaName, SchemaRow } from '../schema/schema-row.types'

/**
 * Technical column stored alongside the Etalab columns: minimal first-level
 * metadata plus a verbatim copy of the canonical program, so the data.gouv
 * widget (chantier 3) can decide where to publish without recomputing, and any
 * future format can be rebuilt from the row.
 */
export interface TechnicalData {
  source: 'tee'
  date_mise_a_jour: string
  statut: Statut
  fitted_schemas: SchemaName[]
  raw_original_data: CanonicalProgramData
}

/**
 * One Grist table row: every Etalab (entreprise) column, the `slug` business key
 * used for upserts, and the `technical` JSON column.
 *
 * The Etalab `id` is carried under the `rnasp_id` colId, NOT `id`: Grist reserves
 * `id` for its built-in integer row id, so a user column named `id` collides (it
 * would be silently remapped and `fetchTable` would return the row id instead of
 * the UUID). The data.gouv widget reads `rnasp_id` and re-publishes it under the
 * Etalab CSV header `id`.
 */
export type GristRecord = Omit<SchemaRow, 'id'> & {
  rnasp_id: string
  slug: string
  technical: string
}
