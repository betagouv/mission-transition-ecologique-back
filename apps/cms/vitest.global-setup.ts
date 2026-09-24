import { Pool } from 'pg'

// Start every test run from a clean slate: drop both schemas of the test
// database (Payload's `public`, the canonical store's `canonical`) so a stale
// schema never triggers Payload's interactive "push schema?" prompt. The test
// database is separate from the dev one, so this never touches dev data.
export async function setup() {
  const url = process.env['DATABASE_URI']
  if (!url) throw new Error('DATABASE_URI is required to reset the test database.')

  const pool = new Pool({ connectionString: url, max: 1 })
  try {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE')
    await pool.query('DROP SCHEMA IF EXISTS canonical CASCADE')
    await pool.query('CREATE SCHEMA public')
  } finally {
    await pool.end()
  }
}
