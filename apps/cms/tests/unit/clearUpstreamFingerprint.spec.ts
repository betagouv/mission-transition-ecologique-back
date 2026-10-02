import { describe, it, expect } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import { clearUpstreamFingerprint } from '@/hooks/shared/clearUpstreamFingerprint'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

const run = (data: Record<string, unknown>, context: Record<string, unknown>) =>
  clearUpstreamFingerprint({ data, req: { context } } as unknown as Parameters<CollectionBeforeChangeHook>[0])

describe('clearUpstreamFingerprint', () => {
  it('clears the fingerprint on an editor write', () => {
    expect(run({ title: 'Audit' }, {})).toEqual({ title: 'Audit', upstreamFingerprint: null })
  })

  it('refuses a fingerprint an API client sends', () => {
    expect(run({ upstreamFingerprint: 'forged' }, {})).toEqual({ upstreamFingerprint: null })
  })

  it('keeps the fingerprint a trusted script writes', () => {
    expect(run({ upstreamFingerprint: 'abc' }, SystemWorkflowContext.create())).toEqual({ upstreamFingerprint: 'abc' })
  })

  it('leaves the stored fingerprint alone on a trusted write that does not carry one', () => {
    expect(run({ title: 'Audit' }, SystemWorkflowContext.create())).toEqual({ title: 'Audit' })
  })
})
