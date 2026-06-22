import { CanonicalProgramService } from '@tee-backoffice/canonical'
import { getCanonicalProgramRepository } from './canonicalRepository'

let servicePromise: Promise<CanonicalProgramService> | undefined

/**
 * Composition root for the program canonical service: injects the concrete
 * libSQL repository into the domain `CanonicalProgramService`. A
 * `CanonicalProjectService` will follow the same shape.
 */
export function getCanonicalProgramService(): Promise<CanonicalProgramService> {
  return (servicePromise ??= getCanonicalProgramRepository().then(
    (repository) => new CanonicalProgramService(repository),
  ))
}
