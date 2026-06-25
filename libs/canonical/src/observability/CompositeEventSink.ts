import type { CanonicalEvent } from './CanonicalEvent'
import type { CanonicalEventSink } from './CanonicalEventSink'

/**
 * Fans one event out to several channels at once: e.g. send every error to
 * email AND Slack by grouping both sinks here behind a single route. One channel
 * throwing must not stop the others.
 */
export class CompositeEventSink implements CanonicalEventSink {
  constructor(private readonly sinks: readonly CanonicalEventSink[]) {}

  emit(event: CanonicalEvent): void {
    for (const sink of this.sinks) {
      try {
        sink.emit(event)
      } catch {
        // A failing channel must never break the others.
      }
    }
  }
}
