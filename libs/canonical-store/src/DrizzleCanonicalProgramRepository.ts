import { and, eq, inArray, ne } from 'drizzle-orm'
import type { z } from 'zod'
import { CanonicalProgramValidator, NullEventSink } from '@tee-backoffice/canonical'
import type {
  CanonicalProgram,
  CanonicalProgramChanges,
  CanonicalProgramKey,
  CanonicalProgramRepository,
  CanonicalEventSink,
} from '@tee-backoffice/canonical'
import { createCanonicalDb, type CanonicalDb } from './db'
import { canonicalPrograms } from './schema'

/**
 * Postgres-backed canonical store. Implements the domain repository port without
 * any CMS dependency: the canonical is persisted as its own JSON, keyed by
 * canonical id, and rebuilt through the validator on read.
 *
 * Rows that no longer validate on read (e.g. after a schema change) are dropped
 * and reported through the event sink, so a format drift never silently hides
 * previously valid programs.
 */
export class DrizzleCanonicalProgramRepository implements CanonicalProgramRepository {
  private constructor(
    private readonly db: CanonicalDb,
    private readonly validator: CanonicalProgramValidator,
    private readonly events: CanonicalEventSink,
  ) {}

  /** Opens (and bootstraps) the canonical store at the given Postgres url. */
  static async create(
    url: string,
    events: CanonicalEventSink = new NullEventSink(),
  ): Promise<DrizzleCanonicalProgramRepository> {
    return DrizzleCanonicalProgramRepository.fromDb(await createCanonicalDb(url), events)
  }

  /** Wraps an already-open connection, e.g. the in-memory PGlite of the tests. */
  static fromDb(
    db: CanonicalDb,
    events: CanonicalEventSink = new NullEventSink(),
  ): DrizzleCanonicalProgramRepository {
    return new DrizzleCanonicalProgramRepository(db, new CanonicalProgramValidator(), events)
  }

  async save(program: CanonicalProgram): Promise<void> {
    const replaced = await this.db.transaction((tx) => this.upsert(tx, program))
    this.reportReplaced(replaced)
  }

  async delete(canonicalId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(canonicalPrograms)
      .where(eq(canonicalPrograms.canonicalId, canonicalId))
      .returning({ canonicalId: canonicalPrograms.canonicalId })
    return deleted.length > 0
  }

  async applyChanges(changes: CanonicalProgramChanges): Promise<void> {
    const replaced = await this.db.transaction(async (tx) => {
      // Deletions first: a superseded row frees its slug for the upstream row.
      if (changes.delete.length > 0) {
        await tx.delete(canonicalPrograms).where(inArray(canonicalPrograms.canonicalId, changes.delete))
      }
      const replaced: CanonicalProgramKey[] = []
      for (const program of changes.save) replaced.push(...(await this.upsert(tx, program)))
      return replaced
    })
    // A row evicted then written again in the same batch (slug swap) was not lost.
    const savedIds = new Set<string>(changes.save.map((program) => program.id))
    this.reportReplaced(replaced.filter((key) => !savedIds.has(key.canonicalId)))
  }

  async listKeys(): Promise<CanonicalProgramKey[]> {
    return this.db
      .select({ canonicalId: canonicalPrograms.canonicalId, slug: canonicalPrograms.slug })
      .from(canonicalPrograms)
  }

  async findBySlug(slug: string): Promise<CanonicalProgram | null> {
    const rows = await this.db
      .select()
      .from(canonicalPrograms)
      .where(eq(canonicalPrograms.slug, slug))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    return this.rebuild(row)
  }

  async findAll(): Promise<CanonicalProgram[]> {
    const rows = await this.db.select().from(canonicalPrograms)

    const programs: CanonicalProgram[] = []
    for (const row of rows) {
      const program = this.rebuild(row)
      if (program) programs.push(program)
    }
    return programs
  }

  /**
   * Must run in a transaction. The slug is unique: a row holding it under
   * another canonical id (e.g. written by the other source, CMS or upstream) is
   * evicted first, and returned, so the upsert never hits the unique constraint.
   */
  private async upsert(db: Pick<CanonicalDb, 'insert' | 'delete'>, program: CanonicalProgram): Promise<CanonicalProgramKey[]> {
    const data = program.toJSON()
    const row = {
      canonicalId: data.id,
      slug: data.slug,
      data: JSON.stringify(data),
      updatedAt: data.date_mise_a_jour,
    }
    const replaced = await db
      .delete(canonicalPrograms)
      .where(and(eq(canonicalPrograms.slug, row.slug), ne(canonicalPrograms.canonicalId, row.canonicalId)))
      .returning({ canonicalId: canonicalPrograms.canonicalId, slug: canonicalPrograms.slug })
    await db
      .insert(canonicalPrograms)
      .values(row)
      .onConflictDoUpdate({
        target: canonicalPrograms.canonicalId,
        set: { slug: row.slug, data: row.data, updatedAt: row.updatedAt },
      })
    return replaced
  }

  /** Emitted once the transaction is committed: an evicted row is a program id consumers lose. */
  private reportReplaced(replaced: CanonicalProgramKey[]): void {
    for (const { canonicalId, slug } of replaced) {
      this.events.emit({ type: 'program_removed', severity: 'info', slug, canonicalId })
    }
  }

  /** Validates a stored row, reporting (and dropping) it when it no longer fits. */
  private rebuild(row: { slug: string; canonicalId: string; data: string }): CanonicalProgram | null {
    // Drift can also leave a row unparseable (interrupted write, manual edit);
    // drop and report it rather than letting one bad row abort the whole read.
    let parsed: unknown
    try {
      parsed = JSON.parse(row.data)
    } catch {
      return this.drop(row, [])
    }

    const result = this.validator.validate(parsed)
    if (result.success) return result.program

    return this.drop(row, result.errors)
  }

  private drop(row: { slug: string; canonicalId: string }, errors: z.ZodIssue[]): null {
    this.events.emit({
      type: 'program_dropped',
      severity: 'warning',
      phase: 'read',
      slug: row.slug,
      canonicalId: row.canonicalId,
      errors,
    })
    return null
  }
}
