import type { CanonicalEventSink } from './CanonicalEventSink'

/** No-op sink: the default so the domain stays injectable without any wiring. */
export class NullEventSink implements CanonicalEventSink {
  emit(): void {}
}
