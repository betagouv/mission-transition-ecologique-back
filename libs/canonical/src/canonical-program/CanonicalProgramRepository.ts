import type { CanonicalProgram } from './CanonicalProgram'
import type { CanonicalChanges, CanonicalKey } from '../snapshot/CanonicalKey'

export type CanonicalProgramKey = CanonicalKey

export type CanonicalProgramChanges = CanonicalChanges<CanonicalProgram>

/**
 * Persistence port for canonical programs. Defined in the domain so it stays
 * CMS-neutral: the canonical is the durable source of truth, and any store
 * (Postgres today, another store tomorrow) implements this contract. The domain knows
 * nothing about the storage technology.
 */
export interface CanonicalProgramRepository {
  /**
   * Inserts or replaces the program identified by its canonical id. The slug is
   * unique: a row holding it under another canonical id is replaced as well.
   */
  save(program: CanonicalProgram): Promise<void>
  /** Returns the stored program for a slug, or null when absent. */
  findBySlug(slug: string): Promise<CanonicalProgram | null>
  /** Returns every stored program. */
  findAll(): Promise<CanonicalProgram[]>
  /** Lists the identity of every stored row, including rows that no longer validate. */
  listKeys(): Promise<CanonicalProgramKey[]>
  /** Removes the program identified by its canonical id. Resolves to whether a row was removed. */
  delete(canonicalId: string): Promise<boolean>
  /** Applies deletions then upserts atomically: either all of them land, or none. */
  applyChanges(changes: CanonicalProgramChanges): Promise<void>
}
