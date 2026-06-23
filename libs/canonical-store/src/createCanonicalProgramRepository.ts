import { fileURLToPath } from 'node:url'
import type { CanonicalProgramRepository } from '@tee-backoffice/canonical'
import { DrizzleCanonicalProgramRepository } from './DrizzleCanonicalProgramRepository'

// The store owns its own database location, so consumers (the CMS) never need to
// know where or how the canonical is persisted. A dedicated libSQL database,
// independent of the CMS, lets the canonical data survive a CMS change.
//
// The default is the canonical.db committed next to this package, located
// relative to this module (not the CWD): every entry point (seed, CMS dev/start)
// then reads the same file whatever directory launches it. CANONICAL_DATABASE_URI
// overrides it for deployments.
const DEFAULT_DATABASE_URL = `file:${fileURLToPath(new URL('../canonical.db', import.meta.url))}`

/**
 * Builds a ready-to-use canonical repository, resolving its database location
 * from `CANONICAL_DATABASE_URI` (default: the committed store database). This is
 * the entry point for application wiring; tests open an explicit `:memory:`
 * store via `DrizzleCanonicalProgramRepository.create`.
 */
export function createCanonicalProgramRepository(): Promise<CanonicalProgramRepository> {
  const url = process.env['CANONICAL_DATABASE_URI'] || DEFAULT_DATABASE_URL
  return DrizzleCanonicalProgramRepository.create(url)
}
