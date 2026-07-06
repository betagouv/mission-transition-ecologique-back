import type { CanonicalProgram } from '@tee-backoffice/canonical'

/**
 * Resolves a `remplace_par` pointer (a canonical cuid2) to the replacing
 * program's slug — the identifier AGIR consumes. The canonical stores the
 * replacement as an internal cuid2; the wire format uses slugs everywhere. Built
 * from the full program set (the map is cheap: one lookup per pivot export).
 */
type Slug = CanonicalProgram['data']['slug']

export class RemplaceParResolver {
  private readonly slugById: Map<string, Slug>

  constructor(programs: readonly CanonicalProgram[]) {
    this.slugById = new Map(programs.map((program) => [program.data.id, program.data.slug]))
  }

  /** The replacing program's slug (branded), or `undefined` if the pointer is unknown. */
  toSlug(cuid2: string): Slug | undefined {
    return this.slugById.get(cuid2)
  }
}
