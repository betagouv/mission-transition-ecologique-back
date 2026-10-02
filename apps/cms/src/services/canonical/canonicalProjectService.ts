import { CanonicalProjectService } from '@tee-backoffice/canonical'
import { getCanonicalProjectRepository } from './canonicalProjectRepository'
import { getCanonicalEventSink } from './observability/canonicalEventSink'
import type { CanonicalLogger } from './observability/PayloadLoggerEventSink'
import { RetryableMemo } from './RetryableMemo'

const service = new RetryableMemo<CanonicalProjectService>()

/**
 * Composition root for the project canonical service: injects the concrete
 * PostgreSQL repository and the event sink into the domain `CanonicalProjectService`.
 * Memoized for the app lifetime; the logger from the first call is captured (see
 * `getCanonicalEventSink`). A failed bootstrap is retried on the next call.
 */
export function getCanonicalProjectService(logger: CanonicalLogger): Promise<CanonicalProjectService> {
  return service.get(() =>
    getCanonicalProjectRepository(logger).then(
      (repository) => new CanonicalProjectService(repository, getCanonicalEventSink(logger)),
    ),
  )
}
