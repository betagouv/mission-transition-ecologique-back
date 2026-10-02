import { describe, it, expect } from 'vitest'
import { slugSchema } from '@tee-backoffice/canonical'
import { CopySlug } from '@/utils/CopySlug'

describe('CopySlug', () => {
  it('lists kebab-case candidates, the plain suffix first', () => {
    const candidates = CopySlug.candidates('plan-action')

    expect(candidates.slice(0, 3)).toEqual(['plan-action-copy', 'plan-action-copy-2', 'plan-action-copy-3'])
    expect(candidates).toHaveLength(10)
    expect(candidates.every((candidate) => slugSchema.safeParse(candidate).success)).toBe(true)
  })

  it('takes the plain suffix when nothing holds it', () => {
    expect(CopySlug.firstFree('plan-action', [])).toBe('plan-action-copy')
    expect(CopySlug.firstFree('plan-action', ['plan-action', 'autre-copy'])).toBe('plan-action-copy')
  })

  it('takes the first number left free', () => {
    expect(CopySlug.firstFree('plan-action', ['plan-action-copy'])).toBe('plan-action-copy-2')
    expect(CopySlug.firstFree('plan-action', ['plan-action-copy', 'plan-action-copy-3'])).toBe('plan-action-copy-2')
    expect(CopySlug.firstFree('plan-action', ['plan-action-copy', 'plan-action-copy-2'])).toBe('plan-action-copy-3')
  })

  it('falls back to a random kebab-case suffix once every candidate is taken', () => {
    const taken = CopySlug.candidates('plan-action')

    const slug = CopySlug.firstFree('plan-action', taken)

    expect(taken).not.toContain(slug)
    expect(slug).toMatch(/^plan-action-copy-[a-z0-9]{8}$/)
    expect(slugSchema.safeParse(slug).success).toBe(true)
  })
})
