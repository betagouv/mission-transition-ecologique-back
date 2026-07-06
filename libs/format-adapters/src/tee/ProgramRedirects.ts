/**
 * Program slug redirects from upstream `redirects.json` — the `program_redirects`
 * map (`former slug → current slug`). When a dispositif is renamed/replaced its
 * former slug is dropped from `programs.json` and a redirect is recorded here, so
 * this table is the only source that knows the former slug still points somewhere.
 * Other keys of the file (`project_redirects`, rowid mappings) are ignored.
 */
export class ProgramRedirects {
  private readonly redirects: Map<string, string>

  constructor(raw: unknown) {
    this.redirects = ProgramRedirects.parse(raw)
  }

  private static parse(raw: unknown): Map<string, string> {
    if (typeof raw !== 'object' || raw === null) return new Map()
    const record = (raw as Record<string, unknown>)['program_redirects']
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
