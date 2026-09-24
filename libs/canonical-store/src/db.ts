import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { CANONICAL_SCHEMA } from './schema'

/**
 * Any Drizzle Postgres connection: node-postgres in the application, PGlite
 * (in-memory Postgres) in the tests. The repository only needs this contract.
 */
export type CanonicalDb = PgDatabase<PgQueryResultHKT, typeof schema>

// Idempotent bootstrap. A single table makes a migration tool unnecessary for
// now; switch to drizzle-kit migrations when the schema grows.
export async function ensureCanonicalSchema(db: CanonicalDb): Promise<void> {
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${CANONICAL_SCHEMA}"`))
  await db.execute(
    sql.raw(`CREATE TABLE IF NOT EXISTS "${CANONICAL_SCHEMA}"."canonical_programs" (
      canonical_id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
  )
}

/** Opens a Postgres connection and ensures the canonical schema exists. */
export async function createCanonicalDb(url: string): Promise<CanonicalDb> {
  // Small addon plans cap connections, and this store is a secondary writer
  // next to Payload's own pool: stay deliberately small.
  const pool = new Pool({ connectionString: url, max: 3 })
  const db = drizzle(pool, { schema })
  await ensureCanonicalSchema(db)
  return db
}
