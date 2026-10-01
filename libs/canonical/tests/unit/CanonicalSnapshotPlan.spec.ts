import { describe, expect, it } from 'vitest'
import { CanonicalSnapshotPlan } from '../../src/snapshot/CanonicalSnapshotPlan'
import { CanonicalSnapshotGuard } from '../../src/snapshot/CanonicalSnapshotGuard'
import { CanonicalSnapshotRejectedError } from '../../src/snapshot/CanonicalSnapshotRejectedError'

interface Entity {
  id: string
  slug: string
}

const key = (canonicalId: string, slug: string) => ({ canonicalId, slug })

describe('CanonicalSnapshotPlan', () => {
  it('puts every stored row in exactly one bucket', () => {
    const existing = [key('id-a', 'a'), key('old-b', 'b'), key('id-c', 'c'), key('id-d', 'd')]
    const valid: Entity[] = [
      { id: 'id-a', slug: 'a' },
      { id: 'new-b', slug: 'b' },
    ]

    const plan = new CanonicalSnapshotPlan(existing, valid, new Set(['c']))

    expect(plan.superseded).toEqual([key('old-b', 'b')])
    expect(plan.kept).toEqual([key('id-c', 'c')])
    expect(plan.removed).toEqual([key('id-d', 'd')])
  })

  it('deletes superseded and removed rows, and saves the valid entities as given', () => {
    const valid: Entity[] = [{ id: 'new-b', slug: 'b' }]
    const plan = new CanonicalSnapshotPlan([key('old-b', 'b'), key('id-d', 'd')], valid, new Set())

    expect(plan.changes()).toEqual({ delete: ['old-b', 'id-d'], save: valid })
  })

  it('follows an entity renamed upstream under the same id', () => {
    const plan = new CanonicalSnapshotPlan([key('id-a', 'ancien')], [{ id: 'id-a', slug: 'nouveau' }], new Set())

    expect(plan.changes().delete).toEqual([])
  })
})

describe('CanonicalSnapshotGuard', () => {
  const emptyPlan = new CanonicalSnapshotPlan<Entity>([key('id-a', 'a')], [], new Set())

  it('names programs by default', () => {
    expect(() => new CanonicalSnapshotGuard().check(emptyPlan)).toThrow('aucun dispositif valide dans le snapshot')
  })

  it('names the entity it is given', () => {
    const guard = new CanonicalSnapshotGuard({ entityLabel: 'projet', maxRemovalRatio: 0, removalAllowance: 0 })
    const plan = new CanonicalSnapshotPlan([key('id-a', 'a'), key('id-b', 'b')], [{ id: 'id-a', slug: 'a' }], new Set())

    expect(() => guard.check(emptyPlan)).toThrow('aucun projet valide dans le snapshot')
    expect(() => guard.check(plan)).toThrow(CanonicalSnapshotRejectedError)
    expect(() => guard.check(plan)).toThrow('1 suppression(s) sur 2 projet(s) stocké(s), limite 0')
  })

  it('counts neither superseded rows nor rows kept under their stored id as removals', () => {
    const guard = new CanonicalSnapshotGuard({ maxRemovalRatio: 0, removalAllowance: 0 })
    const superseding = new CanonicalSnapshotPlan([key('old-a', 'a')], [{ id: 'new-a', slug: 'a' }], new Set())
    const adopting = new CanonicalSnapshotPlan([key('old-a', 'a')], [{ id: 'old-a', slug: 'a' }], new Set())

    expect(() => guard.check(superseding)).not.toThrow()
    expect(() => guard.check(adopting)).not.toThrow()
  })
})
