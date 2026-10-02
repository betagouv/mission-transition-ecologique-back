import { createCanonicalProgramRepository } from '@tee-backoffice/canonical-store'
import type { CanonicalProgramRepository } from '@tee-backoffice/canonical'
import { getCanonicalEventSink } from './observability/canonicalEventSink'
import type { CanonicalLogger } from './observability/PayloadLoggerEventSink'
import { RetryableMemo } from './RetryableMemo'

const repository = new RetryableMemo<CanonicalProgramRepository>()

/**
 * Memoized canonical store, opened once and shared for the app lifetime. The
 * store owns its own database location (independent of Payload), so the CMS only
 * asks for a ready-to-use repository without knowing where the canonical lives.
 * The event sink is injected so rows dropped on read are reported; like the
 * sink, the logger from the first call is captured for the app lifetime. A
 * failed opening is retried on the next call.
 */
export function getCanonicalProgramRepository(logger: CanonicalLogger): Promise<CanonicalProgramRepository> {
  return repository.get(() => createCanonicalProgramRepository(getCanonicalEventSink(logger)))
}
