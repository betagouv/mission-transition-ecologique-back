import type { CanonicalEvent } from './CanonicalEvent'
import type { CanonicalEventSink } from './CanonicalEventSink'
import { RoutingCanonicalEventSink } from './RoutingCanonicalEventSink'

/**
 * Fans one event out to several channels at once: e.g. send every error to
 * email AND Slack by grouping both sinks here behind a single route. A composite
 * is just a router whose every route always matches, so it reuses the router's
 * fan-out and per-channel failure isolation.
 */
export class CompositeEventSink implements CanonicalEventSink {
  private readonly router: RoutingCanonicalEventSink

  constructor(sinks: readonly CanonicalEventSink[]) {
    this.router = new RoutingCanonicalEventSink(sinks.map((sink) => ({ sink, when: () => true })))
  }

  emit(event: CanonicalEvent): void {
    this.router.emit(event)
  }
}
