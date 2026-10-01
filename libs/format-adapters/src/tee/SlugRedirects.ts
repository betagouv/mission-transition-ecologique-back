/**
 * One slug redirect table of upstream `redirects.json` (`former slug → current
 * slug`), read by its key. When an entry is renamed or replaced its former slug
 * leaves the data file and a redirect is recorded here, so this table is the
 * only source that knows the former slug still points somewhere. The other keys
 * of the file are ignored.
 */
export class SlugRedirects {
  private readonly redirects: Map<string, string>

  constructor(raw: unknown, key: string) {
    this.redirects = SlugRedirects.parse(raw, key)
  }

  private static parse(raw: unknown, key: string): Map<string, string> {
    if (typeof raw !== 'object' || raw === null) return new Map()
    const record = (raw as Record<string, unknown>)[key]
    if (typeof record !== 'object' || record === null) return new Map()
    const entries = Object.entries(record as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    )
    return new Map(entries)
  }

  /** Redirect pairs `[formerSlug, currentSlug]`. */
  entries(): [string, string][] {
    return [...this.redirects]
  }

  get size(): number {
    return this.redirects.size
  }
}
