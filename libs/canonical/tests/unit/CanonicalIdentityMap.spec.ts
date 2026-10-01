import { describe, expect, it } from 'vitest'
import { CanonicalIdentityMap } from '../../src/snapshot/CanonicalIdentityMap'

const key = (canonicalId: string, slug: string) => ({ canonicalId, slug })

describe('CanonicalIdentityMap', () => {
  it('maps the id of an entry to the id its slug is stored under', () => {
    const identities = CanonicalIdentityMap.fromSnapshot([key('cms-a', 'a')], [{ id: 'derived-a', slug: 'a' }])

    expect(identities.resolve('derived-a')).toBe('cms-a')
    expect(identities.adopted).toEqual([key('cms-a', 'a')])
    expect(identities.size).toBe(1)
  })

  it('leaves alone an entry new to the store or stored under the id it comes with', () => {
    const identities = CanonicalIdentityMap.fromSnapshot(
      [key('id-a', 'a')],
      [
        { id: 'id-a', slug: 'a' },
        { id: 'id-b', slug: 'b' },
      ],
    )

    expect(identities.size).toBe(0)
    expect(identities.adopted).toEqual([])
    expect(identities.resolveAll(['id-a', 'id-b', 'unknown'])).toEqual(['id-a', 'id-b', 'unknown'])
  })

  it('resolves in one step, never chaining two replacements', () => {
    const identities = CanonicalIdentityMap.fromSnapshot(
      [key('derived-a', 'b'), key('cms-a', 'a')],
      [
        { id: 'derived-a', slug: 'a' },
        { id: 'derived-b', slug: 'b' },
      ],
    )

    expect(identities.resolve('derived-b')).toBe('derived-a')
    expect(identities.resolve('derived-a')).toBe('cms-a')
  })

  it('does not hand a stored id to two entries: the entry followed by id keeps it', () => {
    const identities = CanonicalIdentityMap.fromSnapshot(
      [key('id-a', 'ancien')],
      [
        { id: 'id-a', slug: 'nouveau' },
        { id: 'id-b', slug: 'ancien' },
      ],
    )

    expect(identities.size).toBe(0)
    expect(identities.resolve('id-b')).toBe('id-b')
  })

  it('ignores an entry without a usable id or slug', () => {
    const identities = CanonicalIdentityMap.fromSnapshot([key('cms-a', 'a')], [{ slug: 'a' }, { id: 'id-b' }, { id: 12, slug: 'a' }])

    expect(identities.size).toBe(0)
  })

  it('is empty when asked to be', () => {
    expect(CanonicalIdentityMap.empty().resolve('id-a')).toBe('id-a')
  })
})
