/**
 * Single source of truth for the test database URL, shared by the vitest config
 * (which injects it into the test files) and the global setup (which wipes it).
 * The global setup must never read DATABASE_URI: that variable points at the
 * development database in a normal shell, and wiping it would destroy dev data.
 */
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URI'] ?? 'postgres://tee:tee@localhost:5432/tee_test'
