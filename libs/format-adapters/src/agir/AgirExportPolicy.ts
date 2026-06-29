import type { CanonicalProgram } from '@tee-backoffice/canonical'
import { ExportPolicy } from '../shared/ExportPolicy'
import { AgirEtatMapper } from './AgirEtatMapper'

/**
 * AGIR inclusion policy: a program ships only when it is published
 * (`ExportPolicy.isPublished`) AND its `statut_dispositif` is exportable
 * (`valide` / `temporairement_indisponible`). Used by the index filter and by
 * the per-slug endpoints to decide between a 200 and a 404.
 */
export class AgirExportPolicy {
  static isExportable(program: CanonicalProgram): boolean {
    return ExportPolicy.isPublished(program) && AgirEtatMapper.isExportable(program.statutDispositif)
  }
}
