import { describe, it, expect } from 'vitest'
import { CanonicalAlignment } from '@/services/upstream-sync/CanonicalAlignment'

const key = (slug: string) => ({ canonicalId: `id-${slug}`, slug })

describe('CanonicalAlignment', () => {
  it('is aligned when the store holds exactly what the CMS serves', () => {
    const alignment = CanonicalAlignment.compare(
      [{ ...key('audit'), presence: 'required' }],
      [key('audit')],
    )
    expect(alignment.isAligned).toBe(true)
    expect(alignment.storedCount).toBe(1)
  })

  it('reports a served row the store does not hold', () => {
    const alignment = CanonicalAlignment.compare([{ ...key('audit'), presence: 'required' }], [])
    expect(alignment.missing).toEqual([key('audit')])
    expect(alignment.orphans).toEqual([])
  })

  it('reports a stored row the CMS does not expect', () => {
    const alignment = CanonicalAlignment.compare([], [key('ancien')])
    expect(alignment.orphans).toEqual([key('ancien')])
    expect(alignment.isAligned).toBe(false)
  })

  it('accepts a row that may still be served, stored or not', () => {
    const expected = [{ ...key('en-reecriture'), presence: 'allowed' as const }]
    expect(CanonicalAlignment.compare(expected, [key('en-reecriture')]).isAligned).toBe(true)
    expect(CanonicalAlignment.compare(expected, []).isAligned).toBe(true)
  })
})
