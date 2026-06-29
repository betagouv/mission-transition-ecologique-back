import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

// Idempotent schema bootstrap. A single table makes a migration tool
// unnecessary for now; switch to drizzle-kit migrations when the schema grows.
const ENSURE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS canonical_programs (
  canonical_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`

/** Opens a libSQL connection and ensures the canonical table exists. */
export async function createCanonicalDb(url: string) {
  const client = createClient({ url })
  await client.execute(ENSURE_TABLE_SQL)
  return drizzle(client, { schema })
}

export type CanonicalDb = Awaited<ReturnType<typeof createCanonicalDb>>
