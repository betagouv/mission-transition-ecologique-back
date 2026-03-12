// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect } from 'vitest'
import { seedPrograms } from '@/seed/programs'

let payload: Payload

describe('seedPrograms', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
    await seedPrograms(payload)
  }, 120_000)

  it('creates operators', async () => {
    const result = await payload.find({ collection: 'operators', limit: 0 })
    expect(result.totalDocs).toBeGreaterThan(0)
  })

  it('creates programs', async () => {
    const result = await payload.find({ collection: 'programs', limit: 0 })
    expect(result.totalDocs).toBeGreaterThan(0)
  })

  it('each program has an operator', async () => {
    const result = await payload.find({ collection: 'programs', limit: 10, depth: 0 })
    for (const program of result.docs) {
      expect(program.operator).toBeDefined()
    }
  })

  it('description is a valid lexical editor state', async () => {
    const result = await payload.find({ collection: 'programs', limit: 1 })
    const program = result.docs[0]
    expect(program?.description).toMatchObject({
      root: expect.objectContaining({
        type: 'root',
        children: expect.any(Array),
      }),
    })
  })

  it('description contains lexical nodes from markdown (not flat text)', async () => {
    const result = await payload.find({ collection: 'programs', limit: 5 })
    // At least one program should have a list or heading from markdown conversion
    const hasStructuredNodes = result.docs.some((program) => {
      const root = (program.description as { root?: { children?: Array<{ type: string }> } })?.root
      return root?.children?.some((node) => ['list', 'heading'].includes(node.type))
    })
    expect(hasStructuredNodes).toBe(true)
  })

  it('is idempotent — second run does not create duplicates', async () => {
    const before = await payload.find({ collection: 'programs', limit: 0 })
    const beforeOperators = await payload.find({ collection: 'operators', limit: 0 })

    await seedPrograms(payload)

    const after = await payload.find({ collection: 'programs', limit: 0 })
    const afterOperators = await payload.find({ collection: 'operators', limit: 0 })

    expect(after.totalDocs).toBe(before.totalDocs)
    expect(afterOperators.totalDocs).toBe(beforeOperators.totalDocs)
  }, 120_000)
})
