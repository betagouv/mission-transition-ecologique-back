import { eq } from 'drizzle-orm'
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import type { CanonicalProgram, CanonicalProgramRepository } from '@tee-backoffice/canonical'
import { createCanonicalDb, type CanonicalDb } from './db'
import { canonicalPrograms } from './schema'

/**
 * libSQL-backed canonical store. Implements the domain repository port without
 * any CMS dependency: the canonical is persisted as its own JSON, keyed by
 * canonical id, and rebuilt through the validator on read.
 */
export class DrizzleCanonicalProgramRepository implements CanonicalProgramRepository {
  private constructor(
    private readonly db: CanonicalDb,
    private readonly validator: CanonicalProgramValidator,
  ) {}

  /** Opens (and bootstraps) the canonical store at the given libSQL url. */
  static async create(url: string): Promise<DrizzleCanonicalProgramRepository> {
    const db = await createCanonicalDb(url)
    return new DrizzleCanonicalProgramRepository(db, new CanonicalProgramValidator())
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

    const result = this.validator.validate(JSON.parse(row.data))
    return result.success ? result.program : null
  }
}
