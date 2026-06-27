import type { z } from 'zod'

export type CanonicalEventSeverity = 'info' | 'warning' | 'error'

/** Whether the event happened while persisting (`write`) or reading back (`read`). */
export type CanonicalEventPhase = 'write' | 'read'

/**
 * Domain events emitted along the canonical lifecycle. Channels (logger, Sentry,
 * email, Slack) subscribe to these through the {@link CanonicalEventSink} port,
 * so the domain stays unaware of where an event ends up.
 *
 * The `program_dropped` event makes the silent drops explicit: invalid inputs on
 * write, and stored rows that no longer validate on read (e.g. after a schema
 * change) which would otherwise vanish unnoticed.
 */
export type CanonicalEvent =
  | { type: 'program_saved'; severity: 'info'; slug: string; canonicalId: string }
  | {
      type: 'program_dropped'
      severity: 'warning'
      phase: CanonicalEventPhase
      slug: string
      canonicalId?: string
      errors: z.ZodIssue[]
    }
  | { type: 'sync_failed'; severity: 'error'; slug: string; error: string }
