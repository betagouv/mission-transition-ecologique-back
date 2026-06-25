import type { CanonicalEvent, CanonicalEventSink } from '@tee-backoffice/canonical'

/** Minimal logger contract, satisfied by Payload's pino logger. */
export interface CanonicalLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

/**
 * Logger channel for canonical events: the always-on default. Richer channels
 * (Sentry, email, Slack) are separate adapters implementing `CanonicalEventSink`
 * and wired through the routing sink in `canonicalEventSink.ts`.
 */
export class PayloadLoggerEventSink implements CanonicalEventSink {
  constructor(private readonly logger: CanonicalLogger) {}

  emit(event: CanonicalEvent): void {
    const message = PayloadLoggerEventSink.format(event)
    switch (event.severity) {
      case 'error':
        this.logger.error(message)
        return
      case 'warning':
        this.logger.warn(message)
        return
      case 'info':
        this.logger.info(message)
        return
    }
  }

  private static format(event: CanonicalEvent): string {
    switch (event.type) {
      case 'program_saved':
        return `canonical saved "${event.slug}" (${event.canonicalId})`
      case 'program_dropped':
        return `canonical dropped on ${event.phase} for "${event.slug}": ${event.errors.length.toString()} validation issue(s)`
      case 'sync_failed':
        return `canonical sync failed for "${event.slug}": ${event.error}`
    }
  }
}
