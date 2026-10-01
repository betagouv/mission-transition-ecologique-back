import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'
import { CANONICAL_SCHEMA } from './schema'

/**
 * Any Drizzle Postgres connection: node-postgres in the application, PGlite
 * (in-memory Postgres) in the tests. The repositories only need this contract.
 */
export type CanonicalDb = PgDatabase<PgQueryResultHKT, typeof schema>

const CANONICAL_TABLES = ['canonical_programs', 'canonical_projects'] as const

// Idempotent bootstrap. Two identical tables make a migration tool unnecessary
// for now; switch to drizzle-kit migrations when the schema grows.
export async function ensureCanonicalSchema(db: CanonicalDb): Promise<void> {
  await db.execute(sql.raw(`CREATE SCHEMA IF NOT EXISTS "${CANONICAL_SCHEMA}"`))
  for (const table of CANONICAL_TABLES) {
    await db.execute(
      sql.raw(`CREATE TABLE IF NOT EXISTS "${CANONICAL_SCHEMA}"."${table}" (
        canonical_id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
    )
  }
}

const connections = new Map<string, Promise<CanonicalDb>>()

/**
 * Opens a Postgres connection and ensures the canonical schema exists. The
 * connection is memoized by url: every repository shares one pool, so adding a
 * repository never adds connections on a capped addon.
 */
export function createCanonicalDb(url: string): Promise<CanonicalDb> {
  const existing = connections.get(url)
  if (existing) return existing

  const connection = openCanonicalDb(url).catch((error: unknown) => {
    // A failed bootstrap must not be cached: the next call retries.
    connections.delete(url)
    throw error
  })
  connections.set(url, connection)
  return connection
}

async function openCanonicalDb(url: string): Promise<CanonicalDb> {
  // Small addon plans cap connections, and this store is a secondary writer
  // next to Payload's own pool: stay deliberately small.
  const pool = new Pool({ connectionString: url, max: 3 })
  try {
    const db = drizzle(pool, { schema })
    await ensureCanonicalSchema(db)
    return db
  } catch (error) {
    await pool.end().catch(() => undefined)
    throw error
  }
}
