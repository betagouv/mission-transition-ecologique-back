import type { CanonicalEvent } from './CanonicalEvent'
import type { CanonicalEventSink } from './CanonicalEventSink'

/** Predicate deciding whether a route handles a given event. */
export type CanonicalEventFilter = (event: CanonicalEvent) => boolean

/** Binds a channel to the events it should receive. */
export interface CanonicalEventRoute {
  readonly sink: CanonicalEventSink
  readonly when: CanonicalEventFilter
}

/**
 * Dispatches each event to every route whose filter matches, so the same event
 * can reach several channels. Adding a channel is one new route; the domain and
 * the store never change. A route's sink throwing must not break the others.
 */
export class RoutingCanonicalEventSink implements CanonicalEventSink {
  constructor(private readonly routes: readonly CanonicalEventRoute[]) {}

  emit(event: CanonicalEvent): void {
    for (const route of this.routes) {
      if (!route.when(event)) continue
      try {
        route.sink.emit(event)
      } catch {
        // A failing channel must never break the others.
      }
    }
  }
}
