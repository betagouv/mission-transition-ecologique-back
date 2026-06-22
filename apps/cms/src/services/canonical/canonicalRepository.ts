import { DrizzleCanonicalProgramRepository } from '@tee-backoffice/canonical-store'
import type { CanonicalProgramRepository } from '@tee-backoffice/canonical'

let repositoryPromise: Promise<CanonicalProgramRepository> | undefined

/**
 * Memoized canonical store, opened once from `CANONICAL_DATABASE_URI`. The store
 * lives in its own libSQL database, independent of the Payload database, so the
 * canonical data survives a CMS change.
 */
export function getCanonicalProgramRepository(): Promise<CanonicalProgramRepository> {
  return (repositoryPromise ??= DrizzleCanonicalProgramRepository.create(
    process.env.CANONICAL_DATABASE_URI || 'file:./canonical.db',
  ))
}
