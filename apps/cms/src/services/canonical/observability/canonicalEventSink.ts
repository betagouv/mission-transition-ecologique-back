import { RoutingCanonicalEventSink, type CanonicalEventRoute, type CanonicalEventSink } from '@tee-backoffice/canonical'
import { PayloadLoggerEventSink, type CanonicalLogger } from './PayloadLoggerEventSink'

let sink: CanonicalEventSink | undefined

/**
 * Composition root for canonical observability. Builds the routing sink that
 * decides which canonical event reaches which channel.
 *
 * Memoized for the app lifetime, so the logger captured on the first call is the
 * one used afterwards. This is intentional: `payload.logger` is a single
 * app-wide instance, so every caller passes the same logger anyway.
 *
 * Adding a channel is local to this file: write an adapter implementing
 * `CanonicalEventSink`, then add a route below. New channel/route shapes are
 * documented in ADR 0008 (§6).
 */
export function getCanonicalEventSink(logger: CanonicalLogger): CanonicalEventSink {
  return (sink ??= buildCanonicalEventSink(logger))
}

function buildCanonicalEventSink(logger: CanonicalLogger): CanonicalEventSink {
  const routes: CanonicalEventRoute[] = [
    // Today: every event goes to the application logs.
    { sink: new PayloadLoggerEventSink(logger), when: () => true },
  ]

  return new RoutingCanonicalEventSink(routes)
}
