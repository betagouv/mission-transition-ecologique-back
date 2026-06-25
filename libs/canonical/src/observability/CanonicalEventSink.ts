import type { CanonicalEvent } from './CanonicalEvent'

/**
 * Observability port for canonical events. Defined in the domain so it stays
 * framework-neutral: concrete channels (logger, Sentry, email, Slack) are
 * adapters injected by the composition root.
 *
 * `emit` is fire-and-forget and must never throw: observability can never break
 * a save or a read. Adapters do their own async work and swallow their failures.
 */
export interface CanonicalEventSink {
  emit(event: CanonicalEvent): void
}
