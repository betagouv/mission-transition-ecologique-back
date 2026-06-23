import type { CanonicalProgramRepository } from '@tee-backoffice/canonical'
import { DrizzleCanonicalProgramRepository } from './DrizzleCanonicalProgramRepository'

// The store owns its own database location, so consumers (the CMS) never need
// to know where or how the canonical is persisted. A dedicated libSQL database,
// independent of the CMS, lets the canonical data survive a CMS change.
const DEFAULT_DATABASE_URL = 'file:./canonical.db'

/**
 * Builds a ready-to-use canonical repository, resolving its database location
 * from `CANONICAL_DATABASE_URI` (default: a local libSQL file). This is the
 * entry point for application wiring; tests open an explicit `:memory:` store
 * via `DrizzleCanonicalProgramRepository.create`.
 */
export function createCanonicalProgramRepository(): Promise<CanonicalProgramRepository> {
  const url = process.env.CANONICAL_DATABASE_URI || DEFAULT_DATABASE_URL
  return DrizzleCanonicalProgramRepository.create(url)
}
