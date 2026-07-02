import { rmSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

// Start every test run from a clean slate: remove the test databases declared
// in vitest.config.mts (DATABASE_URI / CANONICAL_DATABASE_URI) so a stale
// schema never triggers Payload's interactive "push schema?" prompt. libSQL
// keeps -wal/-shm sidecar files alongside the .db, so drop those too.
export function setup() {
  const dir = fileURLToPath(new URL('.', import.meta.url))
  const dbFiles = ['tee-pco-test.db', 'canonical-test.db']
  for (const db of dbFiles) {
    for (const suffix of ['', '-wal', '-shm']) {
      rmSync(resolve(dir, `${db}${suffix}`), { force: true })
    }
  }
}
