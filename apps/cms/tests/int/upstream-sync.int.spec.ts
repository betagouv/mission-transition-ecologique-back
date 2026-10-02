// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { createId } from '@paralleldrive/cuid2'
import { CanonicalProjectValidator } from '@tee-backoffice/canonical'
import { SlugCanonicalId, teeProjectsSchema, type TeeProject, type TeeRecord } from '@tee-backoffice/format-adapters'
import { GeographicAreasSeed } from '@/scripts/seed/geographic-areas'
import { CanonicalReconciler } from '@/scripts/sync/CanonicalReconciler'
import { GoneDocumentsCanceller } from '@/scripts/sync/GoneDocumentsCanceller'
import { UpstreamSnapshot } from '@/scripts/sync/UpstreamSnapshot'
import { UpstreamSync, type UpstreamSyncReport } from '@/scripts/sync/UpstreamSync'
import { getCanonicalProjectRepository } from '@/services/canonical/canonicalProjectRepository'
import { getCanonicalProgramRepository } from '@/services/canonical/canonicalRepository'
import { UpstreamRemovalGuard } from '@/services/upstream-sync/UpstreamRemovalGuard'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))

const PROGRAM_A = 'sync-prog-a'
const PROGRAM_B = 'sync-prog-b'
const PROGRAM_C = 'sync-prog-c'
const PROGRAM_FORMER = 'sync-prog-ancien'
// A former slug upstream kept verbatim: not kebab-case.
const PROGRAM_LEGACY = "Sync-Prog-d'avant"

const PROJECT_A = 'sync-proj-a'
const PROJECT_B = 'sync-proj-b'
const PROJECT_C = 'sync-proj-c'
const PROJECT_FORMER = 'sync-proj-ancien'
const PROJECT_LEGACY = 'sync-proj-préventif'
const PROJECT_MANUAL = 'sync-proj-manuel'

// Other test files seed the same database: only this file's documents may be cancelled.
const scope = { programs: { slug: { like: 'sync-prog' } }, projects: { slug: { like: 'sync-proj' } } }

const sourcePrograms = JSON.parse(readFileSync(resolve(fixturesDir, 'programs.json'), 'utf-8')) as TeeRecord[]
const sourceProjects = teeProjectsSchema.parse(JSON.parse(readFileSync(resolve(fixturesDir, 'projects.json'), 'utf-8')))

const program = (source: string, slug: string): TeeRecord => {
  const record = sourcePrograms.find((entry) => entry['id'] === source)
  if (!record) throw new Error(`no program fixture ${source}`)
  return { ...record, id: slug }
}

const project = (source: string, overrides: Partial<TeeProject>): TeeProject => {
  const record = sourceProjects.find((entry) => entry.slug === source)
  if (!record) throw new Error(`no project fixture ${source}`)
  return { ...record, image: undefined, ...overrides }
}

const programs: TeeRecord[] = [
  program('baisse-les-watts', PROGRAM_A),
  program('audit-energetique-en-industrie', PROGRAM_B),
  program('diag-ecoconception', PROGRAM_C),
]

const projects: TeeProject[] = [
  project('fixture-projet-plan-energie', { id: 901, slug: PROJECT_A, linkedProjects: [902], programs: [PROGRAM_A] }),
  project('fixture-projet-audit-energetique', { id: 902, slug: PROJECT_B, linkedProjects: [901], programs: [PROGRAM_B] }),
  project('fixture-projet-eco-conception', { id: 903, slug: PROJECT_C, linkedProjects: [], programs: [PROGRAM_C] }),
]

const redirects = {
  program_redirects: { [PROGRAM_FORMER]: PROGRAM_A, [PROGRAM_LEGACY]: PROGRAM_B },
  project_redirects: { [PROJECT_FORMER]: PROJECT_A, [PROJECT_LEGACY]: PROJECT_B },
}

let payload: Payload

const sync = (snapshot: Partial<{ programs: TeeRecord[]; projects: TeeProject[]; redirects: unknown }> = {}) =>
  new UpstreamSync(
    payload,
    new UpstreamSnapshot(
      snapshot.programs ?? programs,
      snapshot.projects ?? projects,
      [],
      'redirects' in snapshot ? snapshot.redirects : redirects,
    ),
    // The reconciliation looks at the whole database: it is tested on its own below.
    { scope, reconcile: false },
  ).run()

/** Latest version: where an archived, replaced or cancelled document says so. */
const latestProgram = async (slug: string) => {
  const result = await payload.find({
    collection: 'programs',
    where: { slug: { equals: slug } },
    draft: true,
    depth: 0,
    limit: 1,
  })
  const doc = result.docs[0]
  if (!doc) throw new Error(`program ${slug} not found`)
  return doc
}

const latestProject = async (slug: string) => {
  const result = await payload.find({
    collection: 'projects',
    where: { slug: { equals: slug } },
    draft: true,
    depth: 0,
    limit: 1,
  })
  const doc = result.docs[0]
  if (!doc) throw new Error(`project ${slug} not found`)
  return doc
}

const projectBySlug = async (slug: string) => {
  const result = await payload.find({ collection: 'projects', where: { slug: { equals: slug } }, depth: 0, limit: 1 })
  const doc = result.docs[0]
  if (!doc) throw new Error(`project ${slug} not found`)
  return doc
}

const versionCount = async (collection: 'programs' | 'projects', id: number) =>
  (await payload.countVersions({ collection, where: { parent: { equals: id } } })).totalDocs

const storedProgram = async (slug: string) =>
  (await (await getCanonicalProgramRepository(payload.logger)).findBySlug(slug))?.toJSON()

const storedProject = async (slug: string) =>
  (await (await getCanonicalProjectRepository(payload.logger)).findBySlug(slug))?.toJSON()

describe('UpstreamSync', () => {
  let first: UpstreamSyncReport

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await new GeographicAreasSeed(payload).run()
    // Start without this file's documents, whatever a previous run left behind.
    await payload.delete({ collection: 'projects', where: scope.projects })
    await payload.delete({ collection: 'programs', where: scope.programs })

    first = await sync()
  }, 120_000)

  describe('first run', () => {
    it('writes the programs and the projects, redirects included', () => {
      expect(first.errors).toBe(0)
      expect(first.programs).toMatchObject({ created: 5, updated: 0, unchanged: 0, cancelled: [] })
      expect(first.projects).toMatchObject({ created: 5, updated: 0, unchanged: 0, cancelled: [] })
    })

    it('publishes the live programs and feeds the canonical through the hook', async () => {
      const programA = await latestProgram(PROGRAM_A)
      expect(programA).toMatchObject({ workflowStatus: 'publie', _status: 'published' })
      expect(programA.canonicalId).toBe(SlugCanonicalId.from(PROGRAM_A))
      expect(await storedProgram(PROGRAM_A)).toMatchObject({ statut_dispositif: 'valide' })
    })

    it('holds a redirected program in the CMS, replaced by its target', async () => {
      const target = await latestProgram(PROGRAM_A)
      const former = await latestProgram(PROGRAM_FORMER)
      expect(former).toMatchObject({ workflowStatus: 'remplace', replacedBy: target.id, title: target.title })

      expect(await storedProgram(PROGRAM_FORMER)).toMatchObject({
        statut_dispositif: 'remplace',
        remplace_par: SlugCanonicalId.from(PROGRAM_A),
      })
    })

    it('keeps a former program slug verbatim', async () => {
      const former = await latestProgram(PROGRAM_LEGACY)
      expect(former.workflowStatus).toBe('remplace')
      expect(await storedProgram(PROGRAM_LEGACY)).toMatchObject({ slug: PROGRAM_LEGACY, statut_dispositif: 'remplace' })
    })

    it('holds a redirected project in the CMS, replaced by its target, like a program', async () => {
      const target = await latestProject(PROJECT_A)
      const former = await latestProject(PROJECT_FORMER)
      expect(former).toMatchObject({ workflowStatus: 'remplace', replacedBy: target.id, _status: 'draft' })
      expect(target).toMatchObject({ workflowStatus: 'publie', _status: 'published' })

      expect(await storedProject(PROJECT_FORMER)).toMatchObject({
        statut_projet: 'remplace',
        remplace_par: SlugCanonicalId.forProject(PROJECT_A),
      })
      expect(await storedProject(PROJECT_A)).toMatchObject({ statut_projet: 'valide' })
    })

    it('keeps a former project slug verbatim', async () => {
      const former = await latestProject(PROJECT_LEGACY)
      expect(former.workflowStatus).toBe('remplace')
      expect(await storedProject(PROJECT_LEGACY)).toMatchObject({ slug: PROJECT_LEGACY, statut_projet: 'remplace' })
    })

    it('links the projects to each other and to their programs', async () => {
      const projectA = await projectBySlug(PROJECT_A)
      const projectB = await projectBySlug(PROJECT_B)
      expect(projectA.linkedProjects).toEqual([projectB.id])
      expect(projectA.programs).toEqual([(await latestProgram(PROGRAM_A)).id])
      expect((await storedProject(PROJECT_A))?.projets_lies?.projets).toEqual([SlugCanonicalId.forProject(PROJECT_B)])
    })
  })

  describe('second run, upstream unchanged', () => {
    it('writes nothing: no new version of any document', async () => {
      const programA = await latestProgram(PROGRAM_A)
      const formerProgram = await latestProgram(PROGRAM_FORMER)
      const projectA = await projectBySlug(PROJECT_A)
      const formerProject = await projectBySlug(PROJECT_FORMER)
      const before = await Promise.all([
        versionCount('programs', programA.id),
        versionCount('programs', formerProgram.id),
        versionCount('projects', projectA.id),
        versionCount('projects', formerProject.id),
      ])

      const second = await sync()

      expect(second.errors).toBe(0)
      expect(second.programs).toMatchObject({ created: 0, updated: 0, unchanged: 5, cancelled: [] })
      expect(second.projects).toMatchObject({ created: 0, updated: 0, unchanged: 5, cancelled: [] })
      expect(
        await Promise.all([
          versionCount('programs', programA.id),
          versionCount('programs', formerProgram.id),
          versionCount('projects', projectA.id),
          versionCount('projects', formerProject.id),
        ]),
      ).toEqual(before)
    }, 60_000)
  })

  describe('a change made in the back office', () => {
    it('is overwritten by the next run, for a program', async () => {
      const programA = await latestProgram(PROGRAM_A)
      await payload.update({ collection: 'programs', id: programA.id, data: { title: 'Titre retouché' } })
      expect((await latestProgram(PROGRAM_A)).upstreamFingerprint ?? null).toBeNull()

      const report = await sync()

      expect(report.programs).toMatchObject({ updated: 1, unchanged: 4 })
      expect((await latestProgram(PROGRAM_A)).title).toBe(programA.title)
    }, 60_000)

    it('does not publish what a pending draft holds in a field upstream leaves empty', async () => {
      const programA = await latestProgram(PROGRAM_A)
      const upstream = {
        metaDescription: programA.metaDescription ?? null,
        validityEnd: programA.validityEnd ?? null,
        loanAmount: programA.loanAmount ?? null,
        otherOperators: programA.otherOperators ?? [],
      }
      expect(upstream).toMatchObject({ metaDescription: null, loanAmount: null })
      // Saving a draft over a published program is a workflow transition: it takes an editor.
      const admin = await payload.create({
        collection: 'users',
        data: { email: 'upstream-sync-admin@tee.test', password: 'upstream-sync-admin@tee.test', role: 'admin' },
      })
      await payload.update({
        collection: 'programs',
        id: programA.id,
        draft: true,
        user: admin,
        data: {
          metaDescription: 'Description retouchée',
          validityEnd: '2031-01-01T00:00:00.000Z',
          loanAmount: '10 000 €',
          otherOperators: [],
        },
      })

      expect(await latestProgram(PROGRAM_A)).toMatchObject({
        workflowStatus: 'en-cours-modification',
        metaDescription: 'Description retouchée',
      })

      const report = await sync()

      expect(report.programs).toMatchObject({ updated: 1, unchanged: 4 })
      const after = await latestProgram(PROGRAM_A)
      expect(after).toMatchObject({ workflowStatus: 'publie', _status: 'published' })
      expect({
        metaDescription: after.metaDescription ?? null,
        validityEnd: after.validityEnd ?? null,
        loanAmount: after.loanAmount ?? null,
        otherOperators: after.otherOperators ?? [],
      }).toEqual(upstream)
    }, 60_000)

    it('is overwritten by the next run, for a project', async () => {
      const projectC = await projectBySlug(PROJECT_C)
      await payload.update({ collection: 'projects', id: projectC.id, data: { title: 'Titre retouché' } })
      expect((await storedProject(PROJECT_C))?.titre).toBe('Titre retouché')

      const report = await sync()

      expect(report.projects).toMatchObject({ updated: 1, unchanged: 4 })
      expect((await projectBySlug(PROJECT_C)).title).toBe(projectC.title)
      expect((await storedProject(PROJECT_C))?.titre).toBe(projectC.title)
    }, 60_000)
  })

  describe('a document missing from the canonical', () => {
    it('is rewritten even though upstream has not changed', async () => {
      const repository = await getCanonicalProjectRepository(payload.logger)
      await repository.delete(SlugCanonicalId.forProject(PROJECT_C))
      expect(await storedProject(PROJECT_C)).toBeUndefined()

      const report = await sync()

      expect(report.projects).toMatchObject({ updated: 1, unchanged: 4 })
      expect(await storedProject(PROJECT_C)).toMatchObject({ slug: PROJECT_C })
    }, 60_000)
  })

  describe('documents gone upstream', () => {
    let manualId: number

    beforeAll(async () => {
      // Created in the CMS: a random canonical id, nothing upstream knows about.
      const { title, nameTag, shortDescription, longDescription, mainTheme } = await projectBySlug(PROJECT_C)
      const manual = await payload.create({
        collection: 'projects',
        data: { slug: PROJECT_MANUAL, title, nameTag, shortDescription, longDescription, mainTheme, workflowStatus: 'publie' },
      })
      manualId = manual.id
    })

    it('cancels a program and a project that left upstream without a redirect', async () => {
      const report = await sync({
        programs: programs.filter((record) => record['id'] !== PROGRAM_C),
        projects: projects.filter((record) => record.slug !== PROJECT_C),
      })

      expect(report.errors).toBe(0)
      expect(report.programs.cancelled).toEqual([PROGRAM_C])
      expect(report.projects.cancelled).toEqual([PROJECT_C])

      expect((await latestProgram(PROGRAM_C)).workflowStatus).toBe('annule')
      expect(await storedProgram(PROGRAM_C)).toBeUndefined()

      expect((await latestProject(PROJECT_C)).workflowStatus).toBe('annule')
      expect(await storedProject(PROJECT_C)).toBeUndefined()
    }, 60_000)

    it('never cancels a project created in the CMS', async () => {
      const manual = await payload.findByID({ collection: 'projects', id: manualId, depth: 0 })
      expect(manual.workflowStatus).toBe('publie')
      expect(manual.canonicalId).not.toBe(SlugCanonicalId.forProject(PROJECT_MANUAL))
    })

    it('does not cancel them again', async () => {
      const report = await sync({
        programs: programs.filter((record) => record['id'] !== PROGRAM_C),
        projects: projects.filter((record) => record.slug !== PROJECT_C),
      })
      expect(report.programs.cancelled).toEqual([])
      expect(report.projects.cancelled).toEqual([])
    }, 60_000)

    it('brings them back when upstream does', async () => {
      const report = await sync()

      expect(report.errors).toBe(0)
      expect((await latestProgram(PROGRAM_C)).workflowStatus).toBe('publie')
      expect(await storedProgram(PROGRAM_C)).toMatchObject({ statut_dispositif: 'valide' })
      expect(await latestProject(PROJECT_C)).toMatchObject({ workflowStatus: 'publie', _status: 'published' })
      expect((await projectBySlug(PROJECT_C))._status).toBe('published')
      expect(await storedProject(PROJECT_C)).toMatchObject({ statut_projet: 'valide' })
    }, 60_000)

    it('cancels a replaced document whose redirect upstream dropped, former slug included', async () => {
      const report = await sync({
        redirects: {
          program_redirects: { [PROGRAM_FORMER]: PROGRAM_A },
          project_redirects: { [PROJECT_FORMER]: PROJECT_A },
        },
      })

      expect(report.errors).toBe(0)
      expect(report.programs.cancelled).toEqual([PROGRAM_LEGACY])
      expect(report.projects.cancelled).toEqual([PROJECT_LEGACY])
      expect(await storedProgram(PROGRAM_LEGACY)).toBeUndefined()
      expect(await storedProject(PROJECT_LEGACY)).toBeUndefined()
      expect((await latestProject(PROJECT_LEGACY)).workflowStatus).toBe('annule')
    }, 60_000)

    it('cancels nothing when the guard refuses the batch', async () => {
      const strict = new UpstreamRemovalGuard({ removalAllowance: 0, maxRemovalRatio: 0 })
      const report = await GoneDocumentsCanceller.forPrograms(payload, strict, scope.programs).cancel(new Set())

      expect(report.cancelled).toEqual([])
      expect(report.errors).toBe(1)
      expect(report.refused).toContain('limite 0')
      expect((await latestProgram(PROGRAM_A)).workflowStatus).toBe('publie')
    })
  })

  describe('archiving a program in the CMS', () => {
    it('stamps its end date when it has none', async () => {
      const programB = await latestProgram(PROGRAM_B)
      await payload.update({
        collection: 'programs',
        id: programB.id,
        data: { workflowStatus: 'archive', validityEnd: null },
        draft: true,
        context: SystemWorkflowContext.create(),
      })

      const archived = await latestProgram(PROGRAM_B)
      expect(archived.workflowStatus).toBe('archive')
      expect(archived.validityEnd?.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))
    })
  })

  describe('a redirect on a slug upstream no longer publishes', () => {
    const PROGRAM_PUBLISHED = 'sync-prog-publie-avant'
    const PROGRAM_UNPUBLISHED = 'sync-prog-jamais-publie'
    const PROJECT_PUBLISHED = 'sync-proj-publie-avant'

    const redirected = {
      redirects: {
        program_redirects: {
          ...redirects.program_redirects,
          [PROGRAM_PUBLISHED]: PROGRAM_A,
          [PROGRAM_UNPUBLISHED]: PROGRAM_A,
        },
        project_redirects: { ...redirects.project_redirects, [PROJECT_PUBLISHED]: PROJECT_A },
      },
    }
    let publishedTitle: string
    let publishedProjectTitle: string
    let report: UpstreamSyncReport

    const publishedRow = async (collection: 'programs' | 'projects', slug: string) =>
      (await payload.find({ collection, where: { slug: { equals: slug } }, draft: false, depth: 0, limit: 1 })).docs[0]

    beforeAll(async () => {
      // Upstream publishes them first: one program goes live, the other has no url and stays in creation.
      const before = await sync({
        programs: [
          ...programs,
          program('diag-ecoconception', PROGRAM_PUBLISHED),
          { ...program('diag-ecoconception', PROGRAM_UNPUBLISHED), url: '' },
        ],
        projects: [
          ...projects,
          project('fixture-projet-eco-conception', { id: 905, slug: PROJECT_PUBLISHED, linkedProjects: [], programs: [] }),
        ],
      })
      expect(before.errors).toBe(0)
      const published = await latestProgram(PROGRAM_PUBLISHED)
      expect(published.workflowStatus).toBe('publie')
      expect((await latestProgram(PROGRAM_UNPUBLISHED)).workflowStatus).toBe('en-creation')
      publishedTitle = published.title
      publishedProjectTitle = (await projectBySlug(PROJECT_PUBLISHED)).title

      // An editor leaves a draft pending on the published program.
      const admin = await payload.create({
        collection: 'users',
        data: { email: 'redirect-admin@tee.test', password: 'redirect-admin@tee.test', role: 'admin' },
      })
      await payload.update({
        collection: 'programs',
        id: published.id,
        draft: true,
        user: admin,
        data: { title: 'Titre en attente' },
      })

      // Then upstream drops the three records and redirects their slugs.
      report = await sync(redirected)
    }, 120_000)

    // The other test files pick published programs in the same database: these would mislead them.
    afterAll(async () => {
      await payload.delete({ collection: 'projects', where: { slug: { equals: PROJECT_PUBLISHED } } })
      await payload.delete({ collection: 'programs', where: { slug: { in: [PROGRAM_PUBLISHED, PROGRAM_UNPUBLISHED] } } })
    })

    it('keeps the published content of a program, marked replaced, and drops its pending draft', async () => {
      expect(report.errors).toBe(0)
      const target = await latestProgram(PROGRAM_A)
      expect(target.title).not.toBe(publishedTitle)

      expect(await latestProgram(PROGRAM_PUBLISHED)).toMatchObject({
        workflowStatus: 'remplace',
        replacedBy: target.id,
        title: publishedTitle,
      })
      expect(await publishedRow('programs', PROGRAM_PUBLISHED)).toMatchObject({
        workflowStatus: 'publie',
        _status: 'published',
        title: publishedTitle,
      })
      expect(await storedProgram(PROGRAM_PUBLISHED)).toMatchObject({
        statut_dispositif: 'remplace',
        remplace_par: SlugCanonicalId.from(PROGRAM_A),
        titre: publishedTitle,
      })
    })

    it('keeps the published content of a project, marked replaced', async () => {
      const target = await projectBySlug(PROJECT_A)
      expect(target.title).not.toBe(publishedProjectTitle)

      expect(await latestProject(PROJECT_PUBLISHED)).toMatchObject({
        workflowStatus: 'remplace',
        replacedBy: target.id,
        title: publishedProjectTitle,
      })
      expect(await storedProject(PROJECT_PUBLISHED)).toMatchObject({
        statut_projet: 'remplace',
        remplace_par: SlugCanonicalId.forProject(PROJECT_A),
        titre: publishedProjectTitle,
      })
    })

    it('cancels a program that was never published instead of redirecting it', async () => {
      expect(report.programs.cancelled).toEqual([PROGRAM_UNPUBLISHED])
      expect((await latestProgram(PROGRAM_UNPUBLISHED)).workflowStatus).toBe('annule')
      expect(await storedProgram(PROGRAM_UNPUBLISHED)).toBeUndefined()
    })

    it('writes nothing more on the next run', async () => {
      const program = await latestProgram(PROGRAM_PUBLISHED)
      const project = await projectBySlug(PROJECT_PUBLISHED)
      const before = [await versionCount('programs', program.id), await versionCount('projects', project.id)]

      const second = await sync(redirected)

      expect(second.errors).toBe(0)
      expect(second.programs.cancelled).toEqual([])
      expect([await versionCount('programs', program.id), await versionCount('projects', project.id)]).toEqual(before)
      expect((await latestProgram(PROGRAM_UNPUBLISHED)).workflowStatus).toBe('annule')
    }, 60_000)
  })
})

describe('CanonicalReconciler', () => {
  const ORPHAN = 'sync-proj-orphelin'
  // The whole database is compared: other files leave rows of their own behind.
  const reconcile = () => new CanonicalReconciler(payload, UpstreamRemovalGuard.unlimited()).reconcile()

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('reports a served project the canonical does not hold', async () => {
    const repository = await getCanonicalProjectRepository(payload.logger)
    const key = { canonicalId: SlugCanonicalId.forProject(PROJECT_A), slug: PROJECT_A }
    await repository.delete(key.canonicalId)

    const report = await reconcile()

    expect(report.projects.missing).toContainEqual(key)
    expect(report.errors).toBeGreaterThan(0)
  })

  it('withdraws a canonical row the CMS does not expect', async () => {
    const repository = await getCanonicalProjectRepository(payload.logger)
    const served = await storedProject(PROJECT_B)
    const validation = new CanonicalProjectValidator().validate({ ...served, id: createId(), slug: ORPHAN })
    if (!validation.success) throw new Error('orphan fixture should be valid')
    await repository.save(validation.project)

    const report = await reconcile()

    expect(report.projects.removed.map((key) => key.slug)).toContain(ORPHAN)
    expect(await storedProject(ORPHAN)).toBeUndefined()
    expect(await storedProject(PROJECT_B)).toMatchObject({ slug: PROJECT_B })
  })
})
