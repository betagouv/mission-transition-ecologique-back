import { describe, it, expect } from 'vitest'
import type { FieldHook } from 'payload'
import { assignCopyTitle } from '@/hooks/shared/assignCopyTitle'

const run = (value: unknown) => assignCopyTitle({ value } as Parameters<FieldHook>[0])

describe('assignCopyTitle', () => {
  it('marks the title of a copy', () => {
    expect(run('Visite Énergie')).toBe('Visite Énergie (copie)')
  })

  it('does not mark the copy of a copy twice', () => {
    expect(run('Visite Énergie (copie)')).toBe('Visite Énergie (copie)')
  })

  it('leaves an empty or missing title alone', () => {
    expect(run('')).toBe('')
    expect(run('   ')).toBe('   ')
    expect(run(undefined)).toBeUndefined()
    expect(run(null)).toBeNull()
  })
})
