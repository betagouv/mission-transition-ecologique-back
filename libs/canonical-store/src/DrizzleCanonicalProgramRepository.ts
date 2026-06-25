import { eq } from 'drizzle-orm'
import { CanonicalProgramValidator, NullEventSink } from '@tee-backoffice/canonical'
import type {
  CanonicalProgram,
  CanonicalProgramRepository,
  CanonicalEventSink,
} from '@tee-backoffice/canonical'
import { createCanonicalDb, type CanonicalDb } from './db'
import { canonicalPrograms } from './schema'

/**
 * libSQL-backed canonical store. Implements the domain repository port without
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

  /** Opens (and bootstraps) the canonical store at the given libSQL url. */
  static async create(
    url: string,
    events: CanonicalEventSink = new NullEventSink(),
  ): Promise<DrizzleCanonicalProgramRepository> {
    const db = await createCanonicalDb(url)
    return new DrizzleCanonicalProgramRepository(db, new CanonicalProgramValidator(), events)
  }

  async save(program: CanonicalProgram): Promise<void> {
    const data = program.toJSON()
    const row = {
      canonicalId: data.id,
      slug: data.slug,
      data: JSON.stringify(data),
      updatedAt: data.date_mise_a_jour,
    }
    await this.db
      .insert(canonicalPrograms)
      .values(row)
      .onConflictDoUpdate({
        target: canonicalPrograms.canonicalId,
        set: { slug: row.slug, data: row.data, updatedAt: row.updatedAt },
      })
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

  /** Validates a stored row, reporting (and dropping) it when it no longer fits. */
  private rebuild(row: { slug: string; canonicalId: string; data: string }): CanonicalProgram | null {
    const result = this.validator.validate(JSON.parse(row.data))
    if (result.success) return result.program

    this.events.emit({
      type: 'program_dropped',
      severity: 'warning',
      phase: 'read',
      slug: row.slug,
      canonicalId: row.canonicalId,
      errors: result.errors,
    })
    return null
  }
}
