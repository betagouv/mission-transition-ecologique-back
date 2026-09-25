import { describe, it, expect } from 'vitest'
import { CanonicalSyncPolicy } from '@/services/canonical/CanonicalSyncPolicy'

describe('CanonicalSyncPolicy', () => {
  it.each(['publie', 'archive', 'remplace'] as const)('writes a %s program to the canonical', (status) => {
    expect(CanonicalSyncPolicy.actionFor(status)).toBe('save')
  })

  it('withdraws a cancelled program from the canonical', () => {
    expect(CanonicalSyncPolicy.actionFor('annule')).toBe('remove')
  })

  it.each(['en-creation', 'en-relecture', 'en-cours-publication', 'en-cours-modification', 'importe'] as const)(
    'leaves the canonical untouched for a %s program',
    (status) => {
      expect(CanonicalSyncPolicy.actionFor(status)).toBe('keep')
    },
  )
})
