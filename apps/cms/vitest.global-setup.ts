import { DatabaseSchemaReset } from './src/scripts/postdeploy/DatabaseSchemaReset'
import { TEST_DATABASE_URL } from './tests/support/testDatabaseUrl'

// Start every test run from a clean slate so a stale schema never triggers
// Payload's interactive "push schema?" prompt. The URL comes from the shared
// constant, never from DATABASE_URI, which points at the development database
// in a normal shell.
export async function setup() {
  await new DatabaseSchemaReset(TEST_DATABASE_URL).run()
}
