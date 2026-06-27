import type { CanonicalProgram } from '@tee-backoffice/canonical'

/**
 * Export inclusion policy.
 *
 * The edit status decides what ships to public targets (programs.json, AGIR):
 * only published (`pret_prod`) programs are exported. The program status
 * (`temporairement_indisponible`, `remplace`, `archive`…) is not a filter — it
 * is passed through as is.
 */
export class ExportPolicy {
  /** Published = ready for production. */
  static isPublished(program: CanonicalProgram): boolean {
    return program.statutEdition === 'pret_prod'
  }
}
