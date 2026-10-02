import { createCanonicalProjectRepository } from '@tee-backoffice/canonical-store'
import type { CanonicalProjectRepository } from '@tee-backoffice/canonical'
import { getCanonicalEventSink } from './observability/canonicalEventSink'
import type { CanonicalLogger } from './observability/PayloadLoggerEventSink'
import { RetryableMemo } from './RetryableMemo'

const repository = new RetryableMemo<CanonicalProjectRepository>()

/**
 * Memoized canonical project store, the twin of `getCanonicalProgramRepository`:
 * opened once and shared for the app lifetime, on the connection pool the
 * program repository already uses. A failed opening is retried on the next call.
 */
export function getCanonicalProjectRepository(logger: CanonicalLogger): Promise<CanonicalProjectRepository> {
  return repository.get(() => createCanonicalProjectRepository(getCanonicalEventSink(logger)))
}
