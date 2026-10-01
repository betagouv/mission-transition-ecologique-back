import { describe, it, expect } from 'vitest'
import { ProjectCanonicalSyncPolicy } from '@/services/canonical/ProjectCanonicalSyncPolicy'

describe('ProjectCanonicalSyncPolicy', () => {
  it.each([true, false])('writes a published project to the canonical (published version live: %s)', (live) => {
    expect(ProjectCanonicalSyncPolicy.actionFor({ status: 'published', publishedVersionLive: live })).toBe('save')
  })

  it('leaves the canonical untouched for a draft saved over a published version', () => {
    expect(ProjectCanonicalSyncPolicy.actionFor({ status: 'draft', publishedVersionLive: true })).toBe('keep')
  })

  it('withdraws a project that has no published version', () => {
    expect(ProjectCanonicalSyncPolicy.actionFor({ status: 'draft', publishedVersionLive: false })).toBe('remove')
  })
})
