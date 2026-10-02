// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { GeographicAreasSeed } from '@/scripts/seed/geographic-areas'
import { DEPARTEMENTS, REGIONS } from '@/scripts/seed/geographic-areas/fixtures'
import { SlugCanonicalId, TeeProjectImporter, teeProjectsSchema } from '@tee-backoffice/format-adapters'
import { ProgramsSeed } from '@/scripts/seed/programs'
import { ProjectsSeed } from '@/scripts/seed/projects'
import { ProjectImporter, type ImportResult as ProjectsImportResult } from '@/scripts/seed/projects/ProjectImporter'
import { getCanonicalProjectRepository } from '@/services/canonical/canonicalProjectRepository'
import { PayloadMarkdownToRichText } from '@/services/canonical/rich-text/PayloadMarkdownToRichText'
import { CanonicalProjectToPayloadMapper } from '@/services/canonical/to-payload/CanonicalProjectToPayloadMapper'
import { PayloadProgramRelations } from '@/services/canonical/to-payload/PayloadProgramRelations'
import { PayloadProjectRelations } from '@/services/canonical/to-payload/PayloadProjectRelations'
import type { Project } from '../../payload-types'

const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))
const programsFixture = resolve(fixturesDir, 'programs.json')
const projectsFixture = resolve(fixturesDir, 'projects.json')

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

describe('ProjectsSeed', () => {
  const PLAN = 'fixture-projet-plan-energie'
  const AUDIT = 'fixture-projet-audit-energetique'
  const ECO_CONCEPTION = 'fixture-projet-eco-conception'
  const DECHETS = 'fixture-projet-gestion-dechets'
  const MOBILITE = 'fixture-projet-mobilite'
  const SLUGS = [PLAN, AUDIT, ECO_CONCEPTION, DECHETS, MOBILITE]
  const fixtureProjects = { slug: { in: SLUGS } }

  let seed: ProjectsImportResult
  let legacyCanonicalId: string
  let legacyKeys: { canonicalId: string; slug: string }[]
  let draftImage: number

  const projectBySlug = async (slug: string, depth = 0): Promise<Project> => {
    const result = await payload.find({ collection: 'projects', where: { slug: { equals: slug } }, depth, limit: 1 })
    const project = result.docs[0]
    if (!project) throw new Error(`project ${slug} not seeded`)
    return project
  }
  const canonical = () => getCanonicalProjectRepository(payload.logger)
  const storedKeys = async () =>
    (await (await canonical()).listKeys())
      .filter((key) => SLUGS.includes(key.slug))
      .sort((a, b) => a.slug.localeCompare(b.slug))

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await ProgramsSeed.fromFile(payload, programsFixture).run()
    // Other test files seed the same fixture in the same database: start without it,
    // whatever the order of the files.
    await payload.delete({ collection: 'projects', where: fixtureProjects })

    const pixel = readFileSync(resolve(fixturesDir, 'pixel.webp'))
    draftImage = (
      await payload.create({
        collection: 'media',
        data: { alt: 'Image laissée en brouillon', category: 'project-image' },
        file: { data: pixel, mimetype: 'image/webp', name: 'fixture-seed-draft-image.webp', size: pixel.length },
      })
    ).id

    // A project seeded before the pivot existed: random canonical id, already
    // in the store, with a draft pending over its published version.
    const legacy = await payload.create({
      collection: 'projects',
      data: {
        slug: MOBILITE,
        title: 'Ancien titre',
        nameTag: 'ancien',
        shortDescription: 'Ancienne description',
        longDescription: {
          root: {
            type: 'root',
            children: [
              { type: 'paragraph', version: 1, children: [{ type: 'text', text: 'Ancien contenu', format: 0, version: 1 }] },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        mainTheme: 'energy',
        highlightPriority: 0,
        _status: 'published',
      },
    })
    legacyCanonicalId = legacy.canonicalId ?? ''
    legacyKeys = await storedKeys()
    await payload.update({
      collection: 'projects',
      id: legacy.id,
      data: {
        titleFaq: 'Titre laissé en brouillon',
        metaTitle: 'SEO en brouillon',
        image: draftImage,
        linkedProjects: [legacy.id],
        _status: 'draft',
      },
      draft: true,
    })

    seed = await ProjectsSeed.fromFile(payload, projectsFixture).run()
  }, 120_000)

  afterAll(async () => {
    await payload.delete({ collection: 'media', id: draftImage })
  })

  it('imports every project of the fixture, published', async () => {
    expect(seed).toMatchObject({ created: SLUGS.length - 1, updated: 1, errors: 0 })
    const result = await payload.find({ collection: 'projects', where: fixtureProjects, limit: 0, depth: 0 })
    expect(result.totalDocs).toBe(SLUGS.length)
    for (const project of result.docs) expect(project._status).toBe('published')
  })

  it('derives the canonical id from the slug', async () => {
    const result = await payload.find({ collection: 'projects', where: fixtureProjects, limit: 0, depth: 0 })
    for (const project of result.docs) {
      expect(project.canonicalId).toBe(SlugCanonicalId.forProject(project.slug))
    }
  })

  it('brings the FAQ into Payload, answers as rich text', async () => {
    const project = await projectBySlug(PLAN)
    expect(project.titleFaq).toBe("Vos questions sur le plan d'action")
    expect(project.faqs?.map((faq) => faq.question)).toEqual([
      "Combien coûte un plan d'action ?",
      'Combien de temps faut-il ?',
    ])
    const answer = project.faqs?.[1]?.answer.root.children.map((node) => node.type)
    expect(answer).toEqual(['paragraph', 'list'])
  })

  it('brings the priorities into Payload, a missing highlight staying empty', async () => {
    const project = await projectBySlug(PLAN)
    expect(project.defaultPriority).toBe(40)
    expect(project.highlightPriority).toBe(5)
    expect(project.sectorPriorities?.map(({ nafCode, priority }) => ({ nafCode, priority }))).toEqual([
      { nafCode: '55', priority: 2 },
      { nafCode: '55.3', priority: 1 },
      { nafCode: 'C', priority: 3 },
      { nafCode: 'I', priority: 2 },
    ])

    const audit = await projectBySlug(AUDIT)
    expect(audit.defaultPriority).toBe(10)
    expect(audit.highlightPriority ?? null).toBeNull()
  })

  it('links the programs by slug and reports the one the CMS does not have', async () => {
    const project = await projectBySlug(PLAN, 1)
    const slugs = (project.programs ?? []).map((program) => (typeof program === 'object' ? program.slug : program))
    expect(slugs).toEqual(['baisse-les-watts', 'booster-eco-energie-tertiaire', 'fixture-broken-step-link'])
    expect(seed.warnings).toContain(`${PLAN} : dispositif introuvable dans le CMS : fixture-dispositif-absent`)
  })

  it('links the projects in a second pass and reports an unknown upstream id', async () => {
    const plan = await projectBySlug(PLAN)
    const audit = await projectBySlug(AUDIT)
    const ecoConception = await projectBySlug(ECO_CONCEPTION)
    const dechets = await projectBySlug(DECHETS)

    expect(plan.linkedProjects).toEqual([audit.id])
    expect(audit.linkedProjects).toEqual([plan.id])
    expect(dechets.linkedProjects).toEqual([ecoConception.id])
    expect(seed.warnings.some((warning) => warning.startsWith(DECHETS) && warning.includes('999'))).toBe(true)
  })

  it('leaves each linked project with its references in the canonical store', async () => {
    const store = await canonical()
    const plan = (await store.findBySlug(PLAN))?.toJSON()
    const audit = (await store.findBySlug(AUDIT))?.toJSON()

    expect(plan?.projets_lies?.projets).toEqual([SlugCanonicalId.forProject(AUDIT)])
    expect(audit?.projets_lies?.projets).toEqual([SlugCanonicalId.forProject(PLAN)])
    expect(plan?.dispositifs).toEqual(
      ['baisse-les-watts', 'booster-eco-energie-tertiaire', 'fixture-broken-step-link'].map((slug) =>
        SlugCanonicalId.from(slug),
      ),
    )
    expect(plan?.faq?.questions).toHaveLength(2)
    expect(plan?.priorite).toMatchObject({ defaut: 40, mise_en_avant: 5 })
    expect(plan?.priorite?.par_secteur).toHaveLength(4)
  })

  it('realigns a project seeded before the pivot, without leaving its former row', async () => {
    const project = await projectBySlug(MOBILITE)

    expect(legacyKeys).toEqual([{ canonicalId: legacyCanonicalId, slug: MOBILITE }])
    expect(legacyCanonicalId).not.toBe(SlugCanonicalId.forProject(MOBILITE))
    expect(project.canonicalId).toBe(SlugCanonicalId.forProject(MOBILITE))
    expect((await storedKeys()).filter((key) => key.slug === MOBILITE)).toEqual([
      { canonicalId: SlugCanonicalId.forProject(MOBILITE), slug: MOBILITE },
    ])
  })

  it('does not publish the fields of a pending draft upstream does not carry', async () => {
    const project = await projectBySlug(MOBILITE)

    expect(project.title).toBe('Verdir sa flotte de véhicules')
    expect(project.titleFaq ?? null).toBeNull()
    expect(project.metaTitle ?? null).toBeNull()
    expect(project.highlightPriority ?? null).toBeNull()
    // The two fields the importer computes itself follow the same rule.
    expect(project.image ?? null).toBeNull()
    expect(project.linkedProjects ?? []).toEqual([])
  })

  it('stores one canonical row per project', async () => {
    const keys = await storedKeys()
    expect(keys.map((key) => key.slug)).toEqual([...SLUGS].sort())
  })

  it('is idempotent: a second run creates no project and keeps the links', async () => {
    const before = await payload.find({ collection: 'projects', limit: 0 })
    const keysBefore = await storedKeys()

    const second = await ProjectsSeed.fromFile(payload, projectsFixture).run()

    const after = await payload.find({ collection: 'projects', limit: 0 })
    expect(second).toMatchObject({ created: 0, updated: SLUGS.length, errors: 0 })
    expect(after.totalDocs).toBe(before.totalDocs)
    expect(await storedKeys()).toEqual(keysBefore)
    expect((await projectBySlug(PLAN)).linkedProjects).toEqual([(await projectBySlug(AUDIT)).id])
  }, 60_000)

  it('clears the links upstream dropped', async () => {
    const source = JSON.parse(readFileSync(projectsFixture, 'utf-8')) as Record<string, unknown>[]
    const withoutLinks = source
      .filter((project) => project.slug === AUDIT)
      .map((project) => ({ ...project, linkedProjects: [] }))

    await new ProjectsSeed(payload, withoutLinks as never).run()

    expect((await projectBySlug(AUDIT)).linkedProjects ?? []).toEqual([])
    const stored = (await (await canonical()).findBySlug(AUDIT))?.toJSON()
    expect(stored?.projets_lies).toBeUndefined()
  }, 60_000)

  it('writes the published image and links in the first pass, not those of a pending draft', async () => {
    const plan = await projectBySlug(PLAN)
    const ecoConception = await projectBySlug(ECO_CONCEPTION)
    await payload.update({
      collection: 'projects',
      id: plan.id,
      data: { image: draftImage, linkedProjects: [ecoConception.id], _status: 'draft' },
      draft: true,
    })

    // First pass alone, as when the second one fails for this project.
    const records = teeProjectsSchema.parse(JSON.parse(readFileSync(projectsFixture, 'utf-8')))
    const projects = new TeeProjectImporter().importMany(records, new Date().toISOString())
    const mapper = new CanonicalProjectToPayloadMapper(
      await PayloadMarkdownToRichText.create(payload.config),
      await PayloadProjectRelations.fromPayload(payload),
    )
    const { result } = await new ProjectImporter(payload, mapper).import(
      projects.filter((project) => project.slug === PLAN),
    )

    expect(result).toMatchObject({ updated: 1, errors: 0 })
    const published = await projectBySlug(PLAN)
    expect(published._status).toBe('published')
    expect(published.image ?? null).toBeNull()
    expect(published.linkedProjects).toEqual(plan.linkedProjects)
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

describe('PayloadProgramRelations', () => {
  let relations: PayloadProgramRelations

  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    await new GeographicAreasSeed(payload).run()
    relations = await PayloadProgramRelations.fromPayload(payload, new Map())
  }, 60_000)

  it('resolves region, department and overseas collectivity codes to their area', () => {
    expect(relations.areaByCogCode('REG-53')?.name).toBe('Bretagne')
    expect(relations.areaByCogCode('DEP-40')?.name).toBe('Landes')
    expect(relations.areaByCogCode('OM-988')?.name).toBe('Nouvelle-Calédonie')
  })

  it('keeps an overseas department apart from its region of the same name', () => {
    const region = relations.areaByCogCode('REG-01')
    const departement = relations.areaByCogCode('DEP-971')
    expect(region?.name).toBe('Guadeloupe')
    expect(departement?.name).toBe('Guadeloupe')
    expect(departement?.id).not.toBe(region?.id)
  })

  it('knows the region of a department', () => {
    expect(relations.areaByCogCode('DEP-40')?.parentId).toBe(relations.areaByCogCode('REG-75')?.id)
    expect(relations.areaByCogCode('REG-75')?.parentId).toBeUndefined()
  })

  it('returns nothing for a code unknown to the CMS', () => {
    expect(relations.areaByCogCode('REG-99')).toBeUndefined()
  })
})
