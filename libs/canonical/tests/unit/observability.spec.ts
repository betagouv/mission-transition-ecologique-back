import { describe, it, expect } from 'vitest'
import { RoutingCanonicalEventSink } from '../../src/observability/RoutingCanonicalEventSink'
import { CompositeEventSink } from '../../src/observability/CompositeEventSink'
import type { CanonicalEvent } from '../../src/observability/CanonicalEvent'
import type { CanonicalEventSink } from '../../src/observability/CanonicalEventSink'

class RecordingSink implements CanonicalEventSink {
  readonly events: CanonicalEvent[] = []
  emit(event: CanonicalEvent): void {
    this.events.push(event)
  }
}

class ThrowingSink implements CanonicalEventSink {
  emit(): void {
    throw new Error('channel down')
  }
}

const saved: CanonicalEvent = { type: 'program_saved', severity: 'info', slug: 'a', canonicalId: 'id-a' }
const failed: CanonicalEvent = { type: 'sync_failed', severity: 'error', slug: 'b', error: 'boom' }

describe('RoutingCanonicalEventSink', () => {
  it('delivers an event only to routes whose filter matches', () => {
    const all = new RecordingSink()
    const errorsOnly = new RecordingSink()
    const router = new RoutingCanonicalEventSink([
      { sink: all, when: () => true },
      { sink: errorsOnly, when: (e) => e.severity === 'error' },
    ])

    router.emit(saved)
    router.emit(failed)

    expect(all.events).toEqual([saved, failed])
    expect(errorsOnly.events).toEqual([failed])
  })

  it('fans one event out to several channels (e.g. email and Slack)', () => {
    const email = new RecordingSink()
    const slack = new RecordingSink()
    const router = new RoutingCanonicalEventSink([
      { sink: email, when: (e) => e.severity === 'error' },
      { sink: slack, when: (e) => e.severity === 'error' },
    ])

    router.emit(failed)

    expect(email.events).toEqual([failed])
    expect(slack.events).toEqual([failed])
  })

  it('keeps delivering when one channel throws', () => {
    const survivor = new RecordingSink()
    const router = new RoutingCanonicalEventSink([
      { sink: new ThrowingSink(), when: () => true },
      { sink: survivor, when: () => true },
    ])

    expect(() => router.emit(saved)).not.toThrow()
    expect(survivor.events).toEqual([saved])
  })
})

describe('CompositeEventSink', () => {
  it('emits to every grouped channel and isolates failures', () => {
    const survivor = new RecordingSink()
    const composite = new CompositeEventSink([new ThrowingSink(), survivor])

    expect(() => composite.emit(failed)).not.toThrow()
    expect(survivor.events).toEqual([failed])
  })
})
