import type { CanonicalProgram } from '@tee-backoffice/canonical'
import { ExportPolicy } from '../shared/ExportPolicy'
import { StatutMapper } from '../shared/StatutMapper'

/**
 * Gate for the open-data (Grist → data.gouv) export: a dispositif must be
 * published AND have an exportable status (`valide` /
 * `temporairement_indisponible`, {@link StatutMapper.isExportable}).
 * Archived/replaced/abandoned aids never reach the public dataset. This filter
 * is kept independent from AGIR (which now also transmits archived/replaced
 * aids) so the open-data output stays unchanged.
 */
export class SchemaExportPolicy {
  static isExportable(program: CanonicalProgram): boolean {
    return ExportPolicy.isPublished(program) && StatutMapper.isExportable(program.statutDispositif)
  }
}
