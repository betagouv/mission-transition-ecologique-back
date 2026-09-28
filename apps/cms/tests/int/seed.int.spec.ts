// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { GeographicAreasSeed } from '@/scripts/seed/geographic-areas'
import { DEPARTEMENTS, REGIONS } from '@/scripts/seed/geographic-areas/fixtures'
import { ProgramsSeed } from '@/scripts/seed/programs'
import { GeographicAreaResolver } from '@/services/canonical/to-payload/GeographicAreaResolver'

const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))
const programsFixture = resolve(fixturesDir, 'programs.json')

const FIXTURE_PROGRAMS = 23
const FIXTURE_OPERATORS = 8
const EXPECTED_GEOGRAPHIC_AREAS = REGIONS.length + DEPARTEMENTS.length

let payload: Payload

// Other test files seed the same database: scope every count to this fixture.
const fixture = JSON.parse(readFileSync(programsFixture, 'utf-8')) as {
  id: string
  'opérateur de contact': string
  'autres opérateurs'?: string[]
  eligibilityData?: { priorityObjectives?: string[] }
}[]
const fixturePrograms = { slug: { in: fixture.map((program) => program.id) } }
const fixtureOperatorNames = [
  ...new Set(fixture.flatMap((program) => [program['opérateur de contact'], ...(program['autres opérateurs'] ?? [])])),
]

describe('ProgramsSeed', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    await ProgramsSeed.fromFile(payload, programsFixture).run()
  }, 60_000)

  it(`creates ${FIXTURE_OPERATORS} unique operators`, async () => {
    const result = await payload.find({
      collection: 'operators',
      where: { name: { in: fixtureOperatorNames } },
      limit: 0,
    })
    expect(result.totalDocs).toBe(FIXTURE_OPERATORS)
  })

  it(`creates ${FIXTURE_PROGRAMS} programs`, async () => {
    const result = await payload.find({ collection: 'programs', where: fixturePrograms, limit: 0 })
    expect(result.totalDocs).toBe(FIXTURE_PROGRAMS)
  })

  it('fills the themes from the upstream priority objectives', async () => {
    const result = await payload.find({ collection: 'programs', where: fixturePrograms, limit: 0, depth: 0 })
    for (const program of result.docs) {
      const source = fixture.find((entry) => entry.id === program.slug)
      expect([...(program.themes ?? [])].sort()).toEqual([...(source?.eligibilityData?.priorityObjectives ?? [])].sort())
    }
  })

  it('each program has an operator', async () => {
    const result = await payload.find({ collection: 'programs', where: fixturePrograms, limit: 0, depth: 0 })
    for (const program of result.docs) {
      expect(program.operator).toBeDefined()
    }
  })

  it('description is a valid lexical editor state', async () => {
    const result = await payload.find({ collection: 'programs', where: fixturePrograms, limit: 1 })
    const program = result.docs[0]
    expect(program?.description).toMatchObject({
      root: expect.objectContaining({
        type: 'root',
        children: expect.any(Array),
      }),
    })
  })

  it('description contains lexical nodes from markdown (not flat text)', async () => {
    const result = await payload.find({ collection: 'programs', where: fixturePrograms, limit: 0 })
    const hasStructuredNodes = result.docs.some((program) => {
      const root = (program.description as { root?: { children?: Array<{ type: string }> } })?.root
      return root?.children?.some((node) => ['list', 'heading'].includes(node.type))
    })
    expect(hasStructuredNodes).toBe(true)
  })

  it('step descriptions are valid lexical editor states (not flat text)', async () => {
    const result = await payload.find({ collection: 'programs', where: fixturePrograms, limit: 0 })
    const programWithSteps = result.docs.find(
      (program) => Array.isArray(program.steps) && program.steps.length > 0,
    )
    expect(programWithSteps).toBeDefined()
    for (const step of programWithSteps?.steps ?? []) {
      expect(step.description).toMatchObject({
        root: expect.objectContaining({
          type: 'root',
          children: expect.any(Array),
        }),
      })
    }
  })

  it('keeps a program with an invalid step link in draft', async () => {
    const result = await payload.find({
      collection: 'programs',
      where: { slug: { equals: 'fixture-broken-step-link' } },
      limit: 1,
    })
    const program = result.docs[0]
    expect(program).toBeDefined()
    expect(program?._status).toBe('draft')
    expect(program?.workflowStatus).toBe('en-creation')
  })

  it('validates a published program on create, keeping one Payload refuses in creation', async () => {
    const slug = 'fixture-invalid-contact-email'
    const [source] = JSON.parse(readFileSync(programsFixture, 'utf-8')) as Record<string, unknown>[]
    const record = { ...source, id: slug, 'contact question': 'mailto:pas un email' }

    const seed = await new ProgramsSeed(payload, [record as never]).run()

    expect(seed.errors).toBe(0)
    expect([...seed.warnings.keys()].some((warning) => warning.includes(slug))).toBe(true)
    const result = await payload.find({ collection: 'programs', where: { slug: { equals: slug } }, limit: 1 })
    expect(result.docs[0]).toMatchObject({ _status: 'draft', workflowStatus: 'en-creation' })
  })

  it('covers all 5 aid types', async () => {
    const result = await payload.find({ collection: 'programs', where: fixturePrograms, limit: 0 })
    const aidTypes = new Set(result.docs.map((p) => p.aidType))
    expect(aidTypes).toContain('diagnostic-etude')
    expect(aidTypes).toContain('financement')
    expect(aidTypes).toContain('formation')
    expect(aidTypes).toContain('pret')
    expect(aidTypes).toContain('avantage-fiscal')
  })

  it('is idempotent — second run does not create duplicates', async () => {
    const before = await payload.find({ collection: 'programs', limit: 0 })
    const beforeOperators = await payload.find({ collection: 'operators', limit: 0 })

    await ProgramsSeed.fromFile(payload, programsFixture).run()

    const after = await payload.find({ collection: 'programs', limit: 0 })
    const afterOperators = await payload.find({ collection: 'operators', limit: 0 })

    expect(after.totalDocs).toBe(before.totalDocs)
    expect(afterOperators.totalDocs).toBe(beforeOperators.totalDocs)
  }, 60_000)
})

describe('GeographicAreasSeed', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    await new GeographicAreasSeed(payload).run()
  }, 60_000)

  it(`creates ${EXPECTED_GEOGRAPHIC_AREAS} geographic areas (${REGIONS.length} regions + ${DEPARTEMENTS.length} departments)`, async () => {
    const result = await payload.find({ collection: 'geographic-areas', limit: 0 })
    expect(result.totalDocs).toBe(EXPECTED_GEOGRAPHIC_AREAS)
  })

  it('creates regions and departments with the expected coverageType', async () => {
    const regions = await payload.find({
      collection: 'geographic-areas',
      where: { coverageType: { equals: 'region' } },
      limit: 0,
    })
    const departements = await payload.find({
      collection: 'geographic-areas',
      where: { coverageType: { equals: 'departement' } },
      limit: 0,
    })
    expect(regions.totalDocs).toBe(REGIONS.length)
    expect(departements.totalDocs).toBe(DEPARTEMENTS.length)
  })

  it('links each department to its parent region via parentArea', async () => {
    const result = await payload.find({
      collection: 'geographic-areas',
      where: { coverageType: { equals: 'departement' } },
      limit: DEPARTEMENTS.length,
      depth: 0,
    })
    for (const dept of result.docs) {
      expect(dept.parentArea).toBeDefined()
    }
  })

  it('is idempotent — second run does not create duplicates', async () => {
    const before = await payload.find({ collection: 'geographic-areas', limit: 0 })

    await new GeographicAreasSeed(payload).run()

    const after = await payload.find({ collection: 'geographic-areas', limit: 0 })
    expect(after.totalDocs).toBe(before.totalDocs)
  }, 60_000)
})

describe('GeographicAreaResolver', () => {
  let resolver: GeographicAreaResolver

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    await new GeographicAreasSeed(payload).run()
    resolver = await GeographicAreaResolver.fromPayload(payload)
  }, 60_000)

  it('maps the national sentinel to national coverage with no zones', () => {
    const result = resolver.resolve(["France et territoires d'outre-mer"])
    expect(result.geographicCoverage).toBe('national')
    expect(result.geographicAreas).toEqual([])
    expect(result.geographicAreaFeedback).toBeUndefined()
  })

  it('maps a region name to regional coverage with the matching area id', () => {
    const result = resolver.resolve(['Bretagne'])
    expect(result.geographicCoverage).toBe('regional')
    expect(result.geographicAreas).toHaveLength(1)
    expect(result.geographicAreaFeedback).toBeUndefined()
  })

  it('maps a department-only name to departemental coverage with the matching area id', () => {
    const result = resolver.resolve(['Ain'])
    expect(result.geographicCoverage).toBe('departemental')
    expect(result.geographicAreas).toHaveLength(1)
    expect(result.geographicAreaFeedback).toBeUndefined()
  })

  it('reports unmatched names in the feedback field', () => {
    const result = resolver.resolve(['Pays Imaginaire'])
    expect(result.geographicAreaFeedback).toContain('Pays Imaginaire')
    expect(result.geographicAreas).toEqual([])
  })

  it('returns an empty result for undefined input', () => {
    expect(resolver.resolve(undefined)).toEqual({})
  })
})
