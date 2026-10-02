import { and, eq, inArray, ne } from 'drizzle-orm'
import type { z } from 'zod'
import { CanonicalProjectValidator, NullEventSink } from '@tee-backoffice/canonical'
import type {
  CanonicalChanges,
  CanonicalEventSink,
  CanonicalKey,
  CanonicalProject,
  CanonicalProjectRepository,
} from '@tee-backoffice/canonical'
import { createCanonicalDb, type CanonicalDb } from './db'
import { canonicalProjects } from './schema'

/**
 * Postgres-backed canonical project store, the twin of the program repository on
 * its own table: the canonical is persisted as its own JSON, keyed by
 * canonical id, and rebuilt through the validator on read.
 *
 * Rows that no longer validate on read (e.g. after a schema change) are dropped
 * and reported through the event sink, so a format drift never silently hides
 * previously valid projects.
 */
export class DrizzleCanonicalProjectRepository implements CanonicalProjectRepository {
  private constructor(
    private readonly db: CanonicalDb,
    private readonly validator: CanonicalProjectValidator,
    private readonly events: CanonicalEventSink,
  ) {}

  /** Opens (and bootstraps) the canonical store at the given Postgres url. */
  static async create(
    url: string,
    events: CanonicalEventSink = new NullEventSink(),
  ): Promise<DrizzleCanonicalProjectRepository> {
    return DrizzleCanonicalProjectRepository.fromDb(await createCanonicalDb(url), events)
  }

  /** Wraps an already-open connection, e.g. the in-memory PGlite of the tests. */
  static fromDb(
    db: CanonicalDb,
    events: CanonicalEventSink = new NullEventSink(),
  ): DrizzleCanonicalProjectRepository {
    return new DrizzleCanonicalProjectRepository(db, new CanonicalProjectValidator(), events)
  }

  async save(project: CanonicalProject): Promise<void> {
    const replaced = await this.db.transaction((tx) => this.upsert(tx, project))
    this.reportReplaced(replaced)
  }

  async delete(canonicalId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(canonicalProjects)
      .where(eq(canonicalProjects.canonicalId, canonicalId))
      .returning({ canonicalId: canonicalProjects.canonicalId })
    return deleted.length > 0
  }

  async applyChanges(changes: CanonicalChanges<CanonicalProject>): Promise<void> {
    const replaced = await this.db.transaction(async (tx) => {
      // Deletions first: a superseded row frees its slug for the upstream row.
      if (changes.delete.length > 0) {
        await tx.delete(canonicalProjects).where(inArray(canonicalProjects.canonicalId, changes.delete))
      }
      const replaced: CanonicalKey[] = []
      for (const project of changes.save) replaced.push(...(await this.upsert(tx, project)))
      return replaced
    })
    // A row evicted then written again in the same batch (slug swap) was not lost.
    const savedIds = new Set<string>(changes.save.map((project) => project.id))
    this.reportReplaced(replaced.filter((key) => !savedIds.has(key.canonicalId)))
  }

  async listKeys(): Promise<CanonicalKey[]> {
    return this.db
      .select({ canonicalId: canonicalProjects.canonicalId, slug: canonicalProjects.slug })
      .from(canonicalProjects)
  }

  async findBySlug(slug: string): Promise<CanonicalProject | null> {
    const rows = await this.db
      .select()
      .from(canonicalProjects)
      .where(eq(canonicalProjects.slug, slug))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    return this.rebuild(row)
  }

  async findAll(): Promise<CanonicalProject[]> {
    const rows = await this.db.select().from(canonicalProjects)

    const projects: CanonicalProject[] = []
    for (const row of rows) {
      const project = this.rebuild(row)
      if (project) projects.push(project)
    }
    return projects
  }

  /**
   * Must run in a transaction. The slug is unique: a row holding it under
   * another canonical id (e.g. written by the other source, CMS or upstream) is
   * evicted first, and returned, so the upsert never hits the unique constraint.
   */
  private async upsert(db: Pick<CanonicalDb, 'insert' | 'delete'>, project: CanonicalProject): Promise<CanonicalKey[]> {
    const data = project.toJSON()
    const row = {
      canonicalId: data.id,
      slug: data.slug,
      data: JSON.stringify(data),
      updatedAt: data.date_mise_a_jour,
    }
    const replaced = await db
      .delete(canonicalProjects)
      .where(and(eq(canonicalProjects.slug, row.slug), ne(canonicalProjects.canonicalId, row.canonicalId)))
      .returning({ canonicalId: canonicalProjects.canonicalId, slug: canonicalProjects.slug })
    await db
      .insert(canonicalProjects)
      .values(row)
      .onConflictDoUpdate({
        target: canonicalProjects.canonicalId,
        set: { slug: row.slug, data: row.data, updatedAt: row.updatedAt },
      })
    return replaced
  }

  /** Emitted once the transaction is committed: an evicted row is a project id consumers lose. */
  private reportReplaced(replaced: CanonicalKey[]): void {
    for (const { canonicalId, slug } of replaced) {
      this.events.emit({ type: 'project_removed', severity: 'info', slug, canonicalId })
    }
  }

  /** Validates a stored row, reporting (and dropping) it when it no longer fits. */
  private rebuild(row: { slug: string; canonicalId: string; data: string }): CanonicalProject | null {
    // Drift can also leave a row unparseable (interrupted write, manual edit);
    // drop and report it rather than letting one bad row abort the whole read.
    let parsed: unknown
    try {
      parsed = JSON.parse(row.data)
    } catch {
      return this.drop(row, [])
    }

    const result = this.validator.validate(parsed)
    if (result.success) return result.project

    return this.drop(row, result.errors)
  }

  private drop(row: { slug: string; canonicalId: string }, errors: z.ZodIssue[]): null {
    this.events.emit({
      type: 'project_dropped',
      severity: 'warning',
      phase: 'read',
      slug: row.slug,
      canonicalId: row.canonicalId,
      errors,
    })
    return null
  }
}
