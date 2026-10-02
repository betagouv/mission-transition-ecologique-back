import type { CanonicalProgramRepository, CanonicalEventSink } from '@tee-backoffice/canonical'
import { resolveCanonicalDatabaseUrl } from './canonicalDatabaseUrl'
import { DrizzleCanonicalProgramRepository } from './DrizzleCanonicalProgramRepository'

/**
 * Builds a ready-to-use canonical repository against the resolved database.
 * This is the entry point for application wiring; tests open an in-memory
 * PGlite store instead. The optional event sink (injected by the composition
 * root) surfaces rows dropped on read.
 */
export function createCanonicalProgramRepository(
  events?: CanonicalEventSink,
): Promise<CanonicalProgramRepository> {
  return DrizzleCanonicalProgramRepository.create(resolveCanonicalDatabaseUrl(), events)
}
