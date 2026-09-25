import type { CanonicalProgram } from './CanonicalProgram'

/** Identity of a stored row, readable even when its content no longer validates. */
export interface CanonicalProgramKey {
  canonicalId: string
  slug: string
}

/** A set of writes applied as one unit: deletions first, then upserts. */
export interface CanonicalProgramChanges {
  delete: string[]
  save: CanonicalProgram[]
}

/**
 * Persistence port for canonical programs. Defined in the domain so it stays
 * CMS-neutral: the canonical is the durable source of truth, and any store
 * (Postgres today, another store tomorrow) implements this contract. The domain knows
 * nothing about the storage technology.
 */
export interface CanonicalProgramRepository {
  /** Inserts or replaces the program identified by its canonical id. */
  save(program: CanonicalProgram): Promise<void>
  /** Returns the stored program for a slug, or null when absent. */
  findBySlug(slug: string): Promise<CanonicalProgram | null>
  /** Returns every stored program. */
  findAll(): Promise<CanonicalProgram[]>
  /** Lists the identity of every stored row, including rows that no longer validate. */
  listKeys(): Promise<CanonicalProgramKey[]>
  /** Removes the program identified by its canonical id; a no-op when absent. */
  delete(canonicalId: string): Promise<void>
  /** Applies deletions then upserts atomically: either all of them land, or none. */
  applyChanges(changes: CanonicalProgramChanges): Promise<void>
}
