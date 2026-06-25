import { CanonicalProgramService } from '@tee-backoffice/canonical'
import { getCanonicalProgramRepository } from './canonicalRepository'
import { getCanonicalEventSink } from './observability/canonicalEventSink'
import type { CanonicalLogger } from './observability/PayloadLoggerEventSink'

let servicePromise: Promise<CanonicalProgramService> | undefined

/**
 * Composition root for the program canonical service: injects the concrete
 * libSQL repository and the event sink into the domain `CanonicalProgramService`.
 * A `CanonicalProjectService` will follow the same shape.
 */
export function getCanonicalProgramService(logger: CanonicalLogger): Promise<CanonicalProgramService> {
  return (servicePromise ??= getCanonicalProgramRepository(logger).then(
    (repository) => new CanonicalProgramService(repository, getCanonicalEventSink(logger)),
  ))
}
