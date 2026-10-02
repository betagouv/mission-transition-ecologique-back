import { Pool } from 'pg'
import { TEST_DATABASE_URL } from './tests/support/testDatabaseUrl'

// Start every test run from a clean slate: drop both schemas of the test
// database (Payload's `public`, the canonical store's `canonical`) so a stale
// schema never triggers Payload's interactive "push schema?" prompt. The URL
// comes from the shared constant, never from DATABASE_URI, which points at the
// development database in a normal shell.
export async function setup() {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 })
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE')
    await pool.query('DROP SCHEMA IF EXISTS canonical CASCADE')
    await pool.query('CREATE SCHEMA public')
  } finally {
    await pool.end()
  }
}
