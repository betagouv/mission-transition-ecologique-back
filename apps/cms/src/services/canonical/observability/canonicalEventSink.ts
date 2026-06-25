import { RoutingCanonicalEventSink, type CanonicalEventRoute, type CanonicalEventSink } from '@tee-backoffice/canonical'
import { PayloadLoggerEventSink, type CanonicalLogger } from './PayloadLoggerEventSink'

let sink: CanonicalEventSink | undefined

/**
 * Composition root for canonical observability. Builds the routing sink that
 * decides which canonical event reaches which channel. Memoized: a Payload
 * instance keeps the same logger across requests.
 *
 * Adding a channel tomorrow is local to this file: write an adapter implementing
 * `CanonicalEventSink`, then add a route below. The domain and the store never
 * change. A single event can fan out to several channels (one route per channel,
 * or group them with `CompositeEventSink`).
 */
export function getCanonicalEventSink(logger: CanonicalLogger): CanonicalEventSink {
  return (sink ??= buildCanonicalEventSink(logger))
}

function buildCanonicalEventSink(logger: CanonicalLogger): CanonicalEventSink {
  const loggerSink = new PayloadLoggerEventSink(logger)

  const routes: CanonicalEventRoute[] = [
    // Today: every event goes to the application logs.
    { sink: loggerSink, when: () => true },

    // Extension points (documented, not wired yet). Each is a new adapter
    // implementing CanonicalEventSink; import it and add a route:
    //
    //   // anything error-level -> Sentry
    //   { sink: new SentryEventSink(client), when: (e) => e.severity === 'error' },
    //
    //   // schema-drift drops on read -> email
    //   { sink: new EmailEventSink(mailer), when: (e) => e.type === 'program_dropped' && e.phase === 'read' },
    //
    //   // send every error to email AND Slack at once
    //   { sink: new CompositeEventSink([emailSink, slackSink]), when: (e) => e.severity === 'error' },
  ]

  return new RoutingCanonicalEventSink(routes)
}
