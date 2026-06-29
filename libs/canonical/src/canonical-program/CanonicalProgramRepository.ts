import type { CanonicalProgram } from './CanonicalProgram'

/**
 * Persistence port for canonical programs. Defined in the domain so it stays
 * CMS-neutral: the canonical is the durable source of truth, and any store
 * (libSQL today, Postgres tomorrow) implements this contract. The domain knows
 * nothing about the storage technology.
 */
export interface CanonicalProgramRepository {
  /** Inserts or replaces the program identified by its canonical id. */
  save(program: CanonicalProgram): Promise<void>
  /** Returns the stored program for a slug, or null when absent. */
  findBySlug(slug: string): Promise<CanonicalProgram | null>
  /** Returns every stored program. */
  findAll(): Promise<CanonicalProgram[]>
}
