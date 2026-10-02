import { createId } from '@paralleldrive/cuid2'

/**
 * Slug given to the copy of a document: `<slug>-copy`, then `<slug>-copy-2`,
 * `<slug>-copy-3`... Kebab-case, unlike the `<slug> - Copy` Payload derives by
 * default, so the copy can be published without retyping its slug.
 */
export class CopySlug {
  private static readonly SUFFIX = '-copy'
  private static readonly MAX_NUMBERED = 10

  /** Slugs a copy may take, in order of preference. */
  static candidates(slug: string): string[] {
    const base = `${slug}${CopySlug.SUFFIX}`
    return [base, ...Array.from({ length: CopySlug.MAX_NUMBERED - 1 }, (_, index) => `${base}-${index + 2}`)]
  }

  /** First candidate not already taken, or a random suffix once they all are. */
  static firstFree(slug: string, taken: Iterable<string>): string {
    const used = new Set(taken)
    return (
      CopySlug.candidates(slug).find((candidate) => !used.has(candidate)) ??
      `${slug}${CopySlug.SUFFIX}-${createId().slice(0, 8)}`
    )
  }
}
