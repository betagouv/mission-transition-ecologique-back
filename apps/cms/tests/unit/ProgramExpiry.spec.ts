import { describe, it, expect } from 'vitest'
import { ProgramExpiry } from '@/services/upstream-sync/ProgramExpiry'

describe('ProgramExpiry', () => {
  const expiry = new ProgramExpiry('2026-11-24')

  it('expires a program the day after its end date', () => {
    expect(expiry.isExpired('2026-11-23')).toBe(true)
    expect(expiry.isExpired('2026-11-24')).toBe(false)
    expect(expiry.isExpired('2026-12-31')).toBe(false)
  })

  it('never expires a program without end date', () => {
    expect(expiry.isExpired(undefined)).toBe(false)
    expect(expiry.isExpired('')).toBe(false)
  })

  it('reads a date-time end date as its Paris calendar day', () => {
    // 23:30 UTC on the 23rd is already the 24th in Paris.
    expect(expiry.isExpired('2026-11-23T23:30:00Z')).toBe(false)
    expect(expiry.isExpired('2026-11-23T12:00:00Z')).toBe(true)
  })

  it('takes today as a Paris calendar day', () => {
    expect(ProgramExpiry.at(new Date('2026-11-24T23:30:00Z')).isExpired('2026-11-24')).toBe(true)
    expect(ProgramExpiry.at(new Date('2026-11-24T12:00:00Z')).isExpired('2026-11-24')).toBe(false)
  })

  it('never expires a program on an unreadable end date', () => {
    expect(expiry.isExpired('24-12-31')).toBe(false)
    expect(expiry.isExpired('RAS')).toBe(false)
  })
})
