import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CanonicalProgramRepository, CanonicalEventSink } from '@tee-backoffice/canonical'
import { DrizzleCanonicalProgramRepository } from './DrizzleCanonicalProgramRepository'

// The store owns its own database location, so consumers (the CMS) never need to
// know where or how the canonical is persisted. A dedicated libSQL database,
// independent of the CMS, lets the canonical data survive a CMS change.
//
// The default is the canonical.db committed next to this package. It is anchored
// to the workspace (not the CWD) by walking up from the CWD to the pnpm
// workspace marker, so every entry point reads the same file whatever directory
// launches it. This avoids `import.meta.url`, which test/bundler transforms do
// not reliably expose as a `file:` URL. CANONICAL_DATABASE_URI overrides it.
const WORKSPACE_MARKER = 'pnpm-workspace.yaml'
const STORE_DATABASE_PATH = 'libs/canonical-store/canonical.db'

function findWorkspaceRoot(): string {
  let dir = process.cwd()
  while (!existsSync(join(dir, WORKSPACE_MARKER))) {
    const parent = dirname(dir)
    if (parent === dir) return process.cwd()
    dir = parent
  }
  return dir
}

function defaultDatabaseUrl(): string {
  return `file:${join(findWorkspaceRoot(), STORE_DATABASE_PATH)}`
}

/**
 * Builds a ready-to-use canonical repository, resolving its database location
 * from `CANONICAL_DATABASE_URI` (default: the committed store database). This is
 * the entry point for application wiring; tests open an explicit `:memory:`
 * store via `DrizzleCanonicalProgramRepository.create`. The optional event sink
 * (injected by the composition root) surfaces rows dropped on read.
 */
export function createCanonicalProgramRepository(
  events?: CanonicalEventSink,
): Promise<CanonicalProgramRepository> {
  const url = process.env['CANONICAL_DATABASE_URI'] || defaultDatabaseUrl()
  return DrizzleCanonicalProgramRepository.create(url, events)
}
