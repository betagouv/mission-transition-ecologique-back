import type { CanonicalProgram } from '@tee-backoffice/canonical'
import { StatutMapper } from '../shared/StatutMapper'
import type { GristRecord, TechnicalData } from '../grist/grist.types'
import type { SchemaName, SchemaRow } from './schema-row.types'
import { SchemaVocabulary } from './SchemaVocabulary'

/**
 * Assembles a Grist row from the Etalab `SchemaRow`: it adds the `slug` upsert
 * key and the `technical` JSON column (metadata + verbatim canonical). `source`
 * is a static `tee` tag (this whole export is TEE-produced, nothing AGIR leaks
 * into the data.gouv projection); `statut` uses the shared `StatutMapper`. The
 * `fitted_schemas` are resolved upstream (`GristExporter`, which also validates),
 * keeping the structural + Etalab-validity decision in one place.
 */
export class GristRowBuilder {
  static build(program: CanonicalProgram, row: SchemaRow, fittedSchemas: SchemaName[]): GristRecord {
    const d = program.data

    const technical: TechnicalData = {
      source: SchemaVocabulary.SOURCE,
      date_mise_a_jour: d.date_mise_a_jour,
      statut: StatutMapper.toStatut(d.statut_dispositif),
      fitted_schemas: fittedSchemas,
      raw_original_data: program.toJSON(),
    }

    // `id` becomes `rnasp_id` to dodge Grist's reserved row-id column (see grist.types.ts).
    const { id, ...etalabColumns } = row
    return { ...etalabColumns, rnasp_id: id, slug: d.slug, technical: JSON.stringify(technical) }
  }
}
