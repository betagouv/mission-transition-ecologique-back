// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect } from 'vitest'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { ProgramsSeed } from '@/seed/programs'

const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))
const programsFixture = resolve(fixturesDir, 'programs.json')

const FIXTURE_PROGRAMS = 22
const FIXTURE_OPERATORS = 8

let payload: Payload

describe('ProgramsSeed', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    await new ProgramsSeed(payload, programsFixture).run()
  }, 60_000)

  it(`creates ${FIXTURE_OPERATORS} unique operators`, async () => {
    const result = await payload.find({ collection: 'operators', limit: 0 })
    expect(result.totalDocs).toBe(FIXTURE_OPERATORS)
  })

  it(`creates ${FIXTURE_PROGRAMS} programs`, async () => {
    const result = await payload.find({ collection: 'programs', limit: 0 })
    expect(result.totalDocs).toBe(FIXTURE_PROGRAMS)
  })

  it('each program has an operator', async () => {
    const result = await payload.find({ collection: 'programs', limit: FIXTURE_PROGRAMS, depth: 0 })
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
    const result = await payload.find({ collection: 'programs', limit: FIXTURE_PROGRAMS })
    const hasStructuredNodes = result.docs.some((program) => {
      const root = (program.description as { root?: { children?: Array<{ type: string }> } })?.root
      return root?.children?.some((node) => ['list', 'heading'].includes(node.type))
    })
    expect(hasStructuredNodes).toBe(true)
  })

  it('covers all 5 aid types', async () => {
    const result = await payload.find({ collection: 'programs', limit: FIXTURE_PROGRAMS })
    const aidTypes = new Set(result.docs.map((p) => p.aidType))
    expect(aidTypes).toContain('etude')
    expect(aidTypes).toContain('financement')
    expect(aidTypes).toContain('formation')
    expect(aidTypes).toContain('pret')
    expect(aidTypes).toContain('avantage-fiscal')
  })

  it('is idempotent — second run does not create duplicates', async () => {
    const before = await payload.find({ collection: 'programs', limit: 0 })
    const beforeOperators = await payload.find({ collection: 'operators', limit: 0 })

    await new ProgramsSeed(payload, programsFixture).run()

    const after = await payload.find({ collection: 'programs', limit: 0 })
    const afterOperators = await payload.find({ collection: 'operators', limit: 0 })

    expect(after.totalDocs).toBe(before.totalDocs)
    expect(afterOperators.totalDocs).toBe(beforeOperators.totalDocs)
  }, 60_000)
})
