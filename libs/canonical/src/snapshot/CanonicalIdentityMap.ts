import type { CanonicalKey } from './CanonicalKey'

/** What a snapshot entry says of its identity, before any validation. */
export interface CanonicalIdentityClaim {
  id?: unknown
  slug?: unknown
}

/**
 * Keeps the identity of a stored entity stable across writers: a snapshot entry
 * whose slug is already stored under another canonical id (e.g. a row the CMS
 * wrote with its own id) is written under that stored id, and every reference to
 * the id it came with must be rewritten through {@link resolve}. The id carried
 * by a snapshot entry is only used for an entity the store does not know yet.
 */
export class CanonicalIdentityMap {
  private constructor(
    private readonly storedByProvided: ReadonlyMap<string, string>,
    /** Stored keys the snapshot entries are written under instead of the id they came with. */
    readonly adopted: readonly CanonicalKey[],
  ) {}

  static empty(): CanonicalIdentityMap {
    return new CanonicalIdentityMap(new Map(), [])
  }

  static fromSnapshot(stored: readonly CanonicalKey[], entries: readonly CanonicalIdentityClaim[]): CanonicalIdentityMap {
    const storedIdBySlug = new Map(stored.map((key) => [key.slug, key.canonicalId]))
    const candidates: { provided: string; key: CanonicalKey }[] = []
    const claimed = new Set<string>()

    for (const { id, slug } of entries) {
      if (typeof id !== 'string' || typeof slug !== 'string') continue
      const storedId = storedIdBySlug.get(slug)
      if (storedId === undefined || storedId === id) claimed.add(id)
      else candidates.push({ provided: id, key: { canonicalId: storedId, slug } })
    }

    const storedByProvided = new Map<string, string>()
    const adopted: CanonicalKey[] = []
    for (const { provided, key } of candidates) {
      // The stored id is the one another entry keeps (a row followed by id under a new slug): two entries cannot share it.
      if (claimed.has(key.canonicalId)) continue
      storedByProvided.set(provided, key.canonicalId)
      adopted.push(key)
    }
    return new CanonicalIdentityMap(storedByProvided, adopted)
  }

  get size(): number {
    return this.storedByProvided.size
  }

  /** The stored id standing for the given one, or the id itself when it was not replaced. */
  resolve(id: string): string {
    return this.storedByProvided.get(id) ?? id
  }

  resolveAll(ids: readonly string[]): string[] {
    return ids.map((id) => this.resolve(id))
  }
}
