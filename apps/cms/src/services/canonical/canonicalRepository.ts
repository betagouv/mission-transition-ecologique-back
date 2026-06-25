import { createCanonicalProgramRepository } from '@tee-backoffice/canonical-store'
import type { CanonicalProgramRepository } from '@tee-backoffice/canonical'
import { getCanonicalEventSink } from './observability/canonicalEventSink'
import type { CanonicalLogger } from './observability/PayloadLoggerEventSink'

let repositoryPromise: Promise<CanonicalProgramRepository> | undefined

/**
 * Memoized canonical store, opened once and shared for the app lifetime. The
 * store owns its own database location (independent of Payload), so the CMS only
 * asks for a ready-to-use repository without knowing where the canonical lives.
 * The event sink is injected so rows dropped on read are reported.
 */
export function getCanonicalProgramRepository(logger: CanonicalLogger): Promise<CanonicalProgramRepository> {
  return (repositoryPromise ??= createCanonicalProgramRepository(getCanonicalEventSink(logger)))
}
