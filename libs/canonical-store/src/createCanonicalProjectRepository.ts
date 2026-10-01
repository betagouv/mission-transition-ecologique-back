import type { CanonicalProjectRepository, CanonicalEventSink } from '@tee-backoffice/canonical'
import { resolveCanonicalDatabaseUrl } from './canonicalDatabaseUrl'
import { DrizzleCanonicalProjectRepository } from './DrizzleCanonicalProjectRepository'

/**
 * Builds a ready-to-use canonical project repository against the resolved
 * database. It shares the connection pool of the program repository.
 */
export function createCanonicalProjectRepository(
  events?: CanonicalEventSink,
): Promise<CanonicalProjectRepository> {
  return DrizzleCanonicalProjectRepository.create(resolveCanonicalDatabaseUrl(), events)
}
