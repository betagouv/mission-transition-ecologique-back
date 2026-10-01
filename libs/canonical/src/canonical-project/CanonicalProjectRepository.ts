import type { CanonicalProject } from './CanonicalProject'
import type { CanonicalChanges, CanonicalKey } from '../snapshot/CanonicalKey'

/**
 * Persistence port for canonical projects. Same contract as the program port:
 * defined in the domain, implemented by any store, unaware of the storage
 * technology.
 */
export interface CanonicalProjectRepository {
  /**
   * Inserts or replaces the project identified by its canonical id. The slug is
   * unique: a row holding it under another canonical id is replaced as well.
   */
  save(project: CanonicalProject): Promise<void>
  /** Returns the stored project for a slug, or null when absent. */
  findBySlug(slug: string): Promise<CanonicalProject | null>
  /** Returns every stored project. */
  findAll(): Promise<CanonicalProject[]>
  /** Lists the identity of every stored row, including rows that no longer validate. */
  listKeys(): Promise<CanonicalKey[]>
  /** Removes the project identified by its canonical id. Resolves to whether a row was removed. */
  delete(canonicalId: string): Promise<boolean>
  /** Applies deletions then upserts atomically: either all of them land, or none. */
  applyChanges(changes: CanonicalChanges<CanonicalProject>): Promise<void>
}
