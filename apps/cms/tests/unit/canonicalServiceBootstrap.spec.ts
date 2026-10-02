import { describe, it, expect, vi } from 'vitest'
import { CanonicalProgramService, CanonicalProjectService } from '@tee-backoffice/canonical'

const store = vi.hoisted(() => ({
  createCanonicalProjectRepository: vi.fn(),
  createCanonicalProgramRepository: vi.fn(),
}))
vi.mock('@tee-backoffice/canonical-store', () => store)

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

// The singletons live at module level: each test bootstraps a module no other test touches.

describe('canonical service singletons', () => {
  it('retries the project store bootstrap after a failure instead of serving it forever', async () => {
    store.createCanonicalProjectRepository
      .mockRejectedValueOnce(new Error('too many clients'))
      .mockResolvedValue({})
    const { getCanonicalProjectService } = await import('@/services/canonical/canonicalProjectService')

    await expect(getCanonicalProjectService(logger)).rejects.toThrow('too many clients')
    const service = await getCanonicalProjectService(logger)

    expect(service).toBeInstanceOf(CanonicalProjectService)
    expect(await getCanonicalProjectService(logger)).toBe(service)
    expect(store.createCanonicalProjectRepository).toHaveBeenCalledTimes(2)
  })

  it('retries the program store bootstrap after a failure instead of serving it forever', async () => {
    store.createCanonicalProgramRepository
      .mockRejectedValueOnce(new Error('too many clients'))
      .mockResolvedValue({})
    const { getCanonicalProgramService } = await import('@/services/canonical/canonicalProgramService')

    await expect(getCanonicalProgramService(logger)).rejects.toThrow('too many clients')
    const service = await getCanonicalProgramService(logger)

    expect(service).toBeInstanceOf(CanonicalProgramService)
    expect(await getCanonicalProgramService(logger)).toBe(service)
    expect(store.createCanonicalProgramRepository).toHaveBeenCalledTimes(2)
  })
})
