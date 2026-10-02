import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { ensureCanonicalSchema, type CanonicalDb } from '../db'
import * as schema from '../schema'

/**
 * In-memory Postgres (PGlite) for the tests: same dialect as production,
 * without a server or Docker. Kept out of the package entry point so the
 * application bundle never pulls PGlite in.
 */
export class InMemoryCanonicalDb {
  static async create(): Promise<CanonicalDb> {
    const db = drizzle(new PGlite(), { schema })
    await ensureCanonicalSchema(db)
    return db
  }
}
