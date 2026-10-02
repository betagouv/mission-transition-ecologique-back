import { describe, it, expect } from 'vitest'
import { UpstreamRemovalGuard } from '@/services/upstream-sync/UpstreamRemovalGuard'

describe('UpstreamRemovalGuard', () => {
  const guard = new UpstreamRemovalGuard()

  it('tolerates a few removals on a small collection', () => {
    expect(guard.limitFor(12)).toBe(5)
    expect(guard.allows(5, 12)).toBe(true)
    expect(guard.allows(6, 12)).toBe(false)
  })

  it('caps the removals at a tenth of a large collection', () => {
    expect(guard.limitFor(276)).toBe(27)
    expect(guard.allows(27, 276)).toBe(true)
    expect(guard.allows(28, 276)).toBe(false)
  })

  it('refuses nothing when unlimited', () => {
    expect(UpstreamRemovalGuard.unlimited().allows(276, 276)).toBe(true)
  })
})
