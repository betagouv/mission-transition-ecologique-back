import { describe, it, expect } from 'vitest'
import { duplicateAsDraft } from '@/hooks/shared/duplicateAsDraft'

const run = (operation: string, args: Record<string, unknown>) =>
  duplicateAsDraft({ args, operation } as never) as Record<string, unknown>

describe('duplicateAsDraft', () => {
  it('forces the draft flag on a duplication, whatever the caller asked for', () => {
    expect(run('create', { duplicateFromID: 12, data: {} }).draft).toBe(true)
    expect(run('create', { duplicateFromID: 12, draft: false }).draft).toBe(true)
    expect(run('create', { duplicateFromID: 'abc', draft: true }).draft).toBe(true)
  })

  it('leaves a plain creation untouched', () => {
    const args = { data: { title: 'Titre' }, draft: false }

    expect(run('create', args)).toBe(args)
    expect(run('create', { duplicateFromID: undefined, draft: false }).draft).toBe(false)
    expect(run('create', { duplicateFromID: null }).draft).toBeUndefined()
  })

  it('leaves the other operations untouched', () => {
    const args = { id: 12, duplicateFromID: 12, draft: false }

    expect(run('update', args)).toBe(args)
  })
})
