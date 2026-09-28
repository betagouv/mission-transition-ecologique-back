import { describe, it, expect } from 'vitest'
import type { Media, OperatorGroup } from '../../payload-types'
import { OperatorLogoResolver } from '@/services/operators/OperatorLogoResolver'

const media = (id: number): Media => ({
  id,
  alt: `Logo ${id.toString()}`,
  category: 'operator-logo',
  sourcePath: `/images/logos/operateur/${id.toString()}.webp`,
  updatedAt: '2026-09-28T00:00:00.000Z',
  createdAt: '2026-09-28T00:00:00.000Z',
})

const group = (id: number, logo?: Media | number): OperatorGroup => ({
  id,
  name: `Groupe ${id.toString()}`,
  slug: `groupe-${id.toString()}`,
  logo: logo ?? null,
  updatedAt: '2026-09-28T00:00:00.000Z',
  createdAt: '2026-09-28T00:00:00.000Z',
})

describe('OperatorLogoResolver', () => {
  it("keeps the operator's own logo over its groups' logos", () => {
    const own = media(1)
    expect(OperatorLogoResolver.resolve({ logo: own, groups: [group(10, media(2))] })).toEqual({
      logo: own,
      origin: 'operateur',
    })
  })

  it("falls back to the group's logo when the operator has none", () => {
    const groupLogo = media(2)
    expect(OperatorLogoResolver.resolve({ logo: null, groups: [group(10, groupLogo)] })).toEqual({
      logo: groupLogo,
      origin: 'groupe',
    })
  })

  it('takes the first group, in order, that has a logo', () => {
    const cci = media(3)
    const cma = media(4)
    const result = OperatorLogoResolver.resolve({
      logo: undefined,
      groups: [group(10), group(11, cci), group(12, cma)],
    })
    expect(result).toEqual({ logo: cci, origin: 'groupe' })
  })

  it('returns no logo when neither the operator nor its groups have one', () => {
    expect(OperatorLogoResolver.resolve({ logo: null, groups: [group(10)] })).toBeUndefined()
    expect(OperatorLogoResolver.resolve({ logo: null, groups: null })).toBeUndefined()
  })

  it('returns an unpopulated own logo as its id and skips groups left as ids', () => {
    expect(OperatorLogoResolver.resolve({ logo: 7, groups: [] })).toEqual({ logo: 7, origin: 'operateur' })
    expect(OperatorLogoResolver.resolve({ logo: null, groups: [10, group(11, 8)] })).toEqual({
      logo: 8,
      origin: 'groupe',
    })
  })
})
