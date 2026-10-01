/** Identity of a stored row, readable even when its content no longer validates. */
export interface CanonicalKey {
  canonicalId: string
  slug: string
}

/** A set of writes applied as one unit: deletions first, then upserts. */
export interface CanonicalChanges<T> {
  delete: string[]
  save: T[]
}
