import { CanonicalProgramService } from '@tee-backoffice/canonical'
import { getCanonicalProgramRepository } from './canonicalRepository'
import { getCanonicalEventSink } from './observability/canonicalEventSink'
import type { CanonicalLogger } from './observability/PayloadLoggerEventSink'
import { RetryableMemo } from './RetryableMemo'

const service = new RetryableMemo<CanonicalProgramService>()

/**
 * Composition root for the program canonical service: injects the concrete
 * PostgreSQL repository and the event sink into the domain `CanonicalProgramService`.
 * Memoized for the app lifetime; the logger from the first call is captured (see
 * `getCanonicalEventSink`). A failed bootstrap is retried on the next call.
 * `getCanonicalProjectService` follows the same shape.
 */
export function getCanonicalProgramService(logger: CanonicalLogger): Promise<CanonicalProgramService> {
  return service.get(() =>
    getCanonicalProgramRepository(logger).then(
      (repository) => new CanonicalProgramService(repository, getCanonicalEventSink(logger)),
    ),
  )
}
