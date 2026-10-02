import type { Media } from '../../../../payload-types'

/**
 * Decides the value of an upload field (operator logo, project image) fed from
 * upstream. Upstream is master for the files it provided (media with a
 * `sourcePath`): they follow its path and are cleared when it drops them. A file
 * uploaded by hand in the admin (no `sourcePath`) is never overwritten, and a
 * failed download keeps the current file rather than clearing it.
 */
export class ImportedMediaPolicy {
  /**
   * `undefined` means "leave the field unchanged". `current` must be populated
   * (depth ≥ 1): a bare id cannot tell a manual file from an imported one, so it
   * is left untouched.
   */
  static async nextValue(
    current: number | Media | null | undefined,
    upstreamPath: string | undefined,
    importMedia: (path: string) => Promise<number | undefined>,
  ): Promise<number | null | undefined> {
    if (!ImportedMediaPolicy.followsUpstream(current)) return undefined
    if (!upstreamPath) return current ? null : undefined
    return importMedia(upstreamPath)
  }

  private static followsUpstream(current: number | Media | null | undefined): boolean {
    if (current === null || current === undefined) return true
    return typeof current === 'object' && Boolean(current.sourcePath)
  }
}
