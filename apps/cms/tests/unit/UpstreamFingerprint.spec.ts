import { describe, it, expect } from 'vitest'
import { UpstreamFingerprint } from '@/services/upstream-sync/UpstreamFingerprint'

describe('UpstreamFingerprint', () => {
  it('is the same for equal data, whatever the key order', () => {
    const a = { title: 'Audit', themes: ['energy', 'water'], steps: [{ label: 'a', url: 'b' }] }
    const b = { steps: [{ url: 'b', label: 'a' }], themes: ['energy', 'water'], title: 'Audit' }
    expect(UpstreamFingerprint.of(a)).toBe(UpstreamFingerprint.of(b))
  })

  it('ignores an undefined property', () => {
    expect(UpstreamFingerprint.of({ title: 'Audit', image: undefined })).toBe(UpstreamFingerprint.of({ title: 'Audit' }))
  })

  it.each([
    ['a changed value', { title: 'Audit énergie' }],
    ['a reordered list', { title: 'Audit', themes: ['water', 'energy'] }],
    ['a value set to null', { title: 'Audit', themes: ['energy', 'water'], image: null }],
    ['another relation id', { title: 'Audit', themes: ['energy', 'water'], image: 12 }],
  ])('changes with %s', (_label, changed) => {
    const reference = UpstreamFingerprint.of({ title: 'Audit', themes: ['energy', 'water'], image: 7 })
    expect(UpstreamFingerprint.of(changed)).not.toBe(reference)
  })

  it('ignores the random id the Markdown converter gives a rich text node', () => {
    const link = (id: string) => ({
      root: { type: 'root', version: 1, children: [{ type: 'link', version: 3, id, fields: { url: 'https://example.org' } }] },
    })
    expect(UpstreamFingerprint.of(link('6abf809bba85f0165d4a469d'))).toBe(UpstreamFingerprint.of(link('6abf809bba85f0165d4a469e')))
  })

  it('keeps the id of anything else, a relation for instance', () => {
    expect(UpstreamFingerprint.of({ operator: { id: 1 } })).not.toBe(UpstreamFingerprint.of({ operator: { id: 2 } }))
  })

  it('tells a string from the number it spells', () => {
    expect(UpstreamFingerprint.of({ priority: '1' })).not.toBe(UpstreamFingerprint.of({ priority: 1 }))
  })
})
