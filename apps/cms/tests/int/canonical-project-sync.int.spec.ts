// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect, vi } from 'vitest'
import { createId } from '@paralleldrive/cuid2'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { CanonicalProjectValidator, type CanonicalProjectRepository } from '@tee-backoffice/canonical'
import { SlugCanonicalId } from '@tee-backoffice/format-adapters'
import type { Program, Project } from '../../payload-types'
import { ProgramsSeed } from '@/scripts/seed/programs'
import { getCanonicalProjectRepository } from '@/services/canonical/canonicalProjectRepository'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))
const programsFixture = resolve(fixturesDir, 'programs.json')

let payload: Payload
let canonical: CanonicalProjectRepository
let programs: Program[]

const richText = (text: string): Project['longDescription'] => ({
  root: {
    type: 'root',
    children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text, format: 0, version: 1 }] }],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
})

// Each test works on its own project, so the tests stay independent.
const createProject = (slug: string, overrides: Partial<Project> = {}) =>
  payload.create({
    collection: 'projects',
    data: {
      slug,
      title: `Titre ${slug}`,
      nameTag: slug,
      shortDescription: 'Description courte',
      longDescription: richText('Description longue'),
      mainTheme: 'energy',
      ...overrides,
    },
  })

const publishProject = (slug: string, overrides: Partial<Project> = {}) =>
  createProject(slug, { _status: 'published', ...overrides })

const update = (id: number, data: Partial<Project>, draft = false) =>
  payload.update({ collection: 'projects', id, data, draft })

const mainRow = (id: number) => payload.findByID({ collection: 'projects', id, depth: 0, draft: false })

const storedKeys = async (slug: string) => (await canonical.listKeys()).filter((key) => key.slug === slug)

describe('canonical project sync hooks', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await ProgramsSeed.fromFile(payload, programsFixture).run()
    canonical = await getCanonicalProjectRepository(payload.logger)

    programs = (
      await payload.find({ collection: 'programs', where: { workflowStatus: { equals: 'publie' } }, limit: 2, depth: 0 })
    ).docs
    expect(programs).toHaveLength(2)
  }, 60_000)

  it('keeps a project created as a draft out of the canonical', async () => {
    const project = await createProject('sync-brouillon')

    expect(project._status).toBe('draft')
    expect(project.canonicalId).toBeTruthy()
    expect(await canonical.findBySlug(project.slug)).toBeNull()
  })

  it('keeps a draft that was never published out of the canonical when it is saved again', async () => {
    const project = await createProject('sync-brouillon-modifie')
    await update(project.id, { title: 'Brouillon retravaillé' }, true)
    await update(project.id, { title: 'Brouillon retravaillé encore' })

    expect(await canonical.findBySlug(project.slug)).toBeNull()
  })

  it('mirrors a project into the canonical once it is published', async () => {
    const project = await createProject('sync-publie')
    await update(project.id, { _status: 'published' })

    const stored = await canonical.findBySlug(project.slug)
    expect(stored?.id).toBe(project.canonicalId)
    expect(stored?.statutProjet).toBe('valide')
    expect(stored?.toJSON().titre).toBe(project.title)
  })

  it('keeps the published version live while a draft is saved over it, then pushes the republished one', async () => {
    const project = await publishProject('sync-reecriture')

    await update(project.id, { title: 'Titre en cours de réécriture', _status: 'draft' }, true)

    // The draft only lands in the versions table: the main row stays published.
    const main = await mainRow(project.id)
    expect(main._status).toBe('published')
    expect(main.title).toBe(project.title)
    expect((await canonical.findBySlug(project.slug))?.toJSON().titre).toBe(project.title)

    await update(project.id, { _status: 'published' })

    expect((await canonical.findBySlug(project.slug))?.toJSON().titre).toBe('Titre en cours de réécriture')
    expect(await storedKeys(project.slug)).toEqual([{ canonicalId: project.canonicalId, slug: project.slug }])
  })

  it('withdraws an unpublished project', async () => {
    const project = await publishProject('sync-depublie')
    expect(await canonical.findBySlug(project.slug)).not.toBeNull()

    await update(project.id, { _status: 'draft' })

    expect((await mainRow(project.id))._status).toBe('draft')
    expect(await canonical.findBySlug(project.slug)).toBeNull()
  })

  it('withdraws a deleted project', async () => {
    const project = await publishProject('sync-supprime')
    expect(await canonical.findBySlug(project.slug)).not.toBeNull()

    await payload.delete({ collection: 'projects', id: project.id })

    expect(await canonical.findBySlug(project.slug)).toBeNull()
  })

  it('carries the FAQ, the priorities, the linked programs and the linked projects', async () => {
    const linked = await publishProject('sync-projet-lie')
    const project = await publishProject('sync-complet', {
      titleFaq: 'Questions fréquentes',
      faqs: [{ question: 'Combien ça coûte ?', answer: richText('Cela dépend.') }],
      highlightPriority: 2,
      defaultPriority: 5,
      sectorPriorities: [
        { nafCode: 'C', priority: 1 },
        { nafCode: '55.3', priority: 3 },
      ],
      programs: programs.map((program) => program.id),
      titleLinkedProjects: 'À voir aussi',
      linkedProjects: [linked.id],
    })

    const data = (await canonical.findBySlug(project.slug))?.toJSON()
    expect(data?.faq).toEqual({
      titre: 'Questions fréquentes',
      questions: [{ question: 'Combien ça coûte ?', reponse: 'Cela dépend.' }],
    })
    expect(data?.priorite).toEqual({
      defaut: 5,
      mise_en_avant: 2,
      par_secteur: [
        { code_naf: 'C', priorite: 1 },
        { code_naf: '55.3', priorite: 3 },
      ],
    })
    expect(data?.dispositifs).toEqual(programs.map((program) => program.canonicalId))
    expect(data?.projets_lies).toEqual({ titre: 'À voir aussi', projets: [linked.canonicalId] })
    expect(data?.description_longue).toEqual({ contenu: 'Description longue' })
    expect(data?.theme_principal).toBe('energie')
  })

  it('lets a system write realign the canonical id, moving the stored row', async () => {
    const project = await publishProject('sync-realigne')
    const realigned = createId()

    await payload.update({
      collection: 'projects',
      id: project.id,
      data: { canonicalId: realigned },
      context: SystemWorkflowContext.create(),
    })

    expect((await mainRow(project.id)).canonicalId).toBe(realigned)
    expect(await storedKeys(project.slug)).toEqual([{ canonicalId: realigned, slug: project.slug }])
  })

  it('keeps the published row served while a draft carries a realigned canonical id', async () => {
    const project = await publishProject('sync-realigne-brouillon')

    await payload.update({
      collection: 'projects',
      id: project.id,
      data: { canonicalId: createId() },
      draft: true,
      context: SystemWorkflowContext.create(),
    })

    expect(await storedKeys(project.slug)).toEqual([{ canonicalId: project.canonicalId, slug: project.slug }])
  })

  it('ignores a canonical id sent outside the system context', async () => {
    const project = await publishProject('sync-id-verrouille')

    await update(project.id, { canonicalId: createId(), title: 'Titre modifié' })

    expect((await mainRow(project.id)).canonicalId).toBe(project.canonicalId)
    expect(await storedKeys(project.slug)).toEqual([{ canonicalId: project.canonicalId, slug: project.slug }])
  })

  it('never blocks the CMS write when the canonical sync fails', async () => {
    // Payload validates everything the pivot would refuse: the failure is simulated at the store.
    const save = vi.spyOn(canonical, 'save').mockRejectedValueOnce(new Error('store unreachable'))
    const logged = vi.spyOn(payload.logger, 'error')

    const project = await publishProject('sync-en-echec')
    const errors = logged.mock.calls.map((call) => String(call[0]))
    save.mockRestore()
    logged.mockRestore()

    expect(project._status).toBe('published')
    expect(errors.filter((message) => message.includes('sync failed'))).toHaveLength(1)
    expect(await canonical.findBySlug(project.slug)).toBeNull()
  })

  it('takes over the row the upstream import stored under the same slug with another id', async () => {
    const slug = 'sync-slug-deja-importe'
    const upstreamId = SlugCanonicalId.forProject(slug)
    await canonical.save(
      new CanonicalProjectValidator().parse({
        id: upstreamId,
        slug,
        source: 'INTERNE',
        date_mise_a_jour: new Date().toISOString(),
        statut_projet: 'valide',
        titre: 'Projet importé depuis l’amont',
        nom_court: 'importé',
        description_courte: 'Description amont',
        description_longue: { contenu: 'Contenu amont' },
        theme_principal: 'energie',
      }),
    )
    const logged = vi.spyOn(payload.logger, 'error')

    const project = await publishProject(slug)
    const errors = logged.mock.calls.map((call) => String(call[0]))
    logged.mockRestore()

    expect(project.canonicalId).not.toBe(upstreamId)
    expect(errors.filter((message) => message.includes('sync failed'))).toEqual([])
    expect(await storedKeys(slug)).toEqual([{ canonicalId: project.canonicalId, slug }])
    expect((await canonical.findBySlug(slug))?.toJSON().titre).toBe(project.title)
  })

  describe('values the pivot would refuse', () => {
    const publish = (slug: string, overrides: Partial<Project>) => publishProject(slug, overrides)

    it('refuses a slug that is not kebab-case when the project is published', async () => {
      await expect(publish('Sync_Slug Invalide', {})).rejects.toThrow(/slug|Identifiant/)
      await expect(publish('sync-slug-accentué', {})).rejects.toThrow(/slug|Identifiant/)
      expect(await canonical.findBySlug('Sync_Slug Invalide')).toBeNull()
    })

    it('lets a draft carry such a slug, then refuses to publish it', async () => {
      const draft = await payload.create({
        collection: 'projects',
        draft: true,
        data: {
          slug: 'Sync Brouillon',
          title: 'Brouillon au slug provisoire',
          nameTag: 'brouillon',
          shortDescription: 'Description courte',
          longDescription: richText('Description longue'),
          mainTheme: 'energy',
        },
      })

      await expect(update(draft.id, { _status: 'published' })).rejects.toThrow(/slug|Identifiant/)
      await update(draft.id, { slug: 'sync-brouillon-corrige', _status: 'published' })
      expect((await canonical.findBySlug('sync-brouillon-corrige'))?.id).toBe(draft.canonicalId)
    })

    it('refuses a decimal priority when the project is published', async () => {
      await expect(publish('sync-priorite-defaut', { defaultPriority: 1.5 })).rejects.toThrow(/defaultPriority|Priorité/)
      await expect(publish('sync-priorite-mise-en-avant', { highlightPriority: 0.5 })).rejects.toThrow(
        /highlightPriority|Priorité/,
      )
      await expect(
        publish('sync-priorite-secteur', { sectorPriorities: [{ nafCode: 'C', priority: 2.5 }] }),
      ).rejects.toThrow(/priority|Priorité/)
    })

    it('still requires the priority of a sector row, and refuses a padded NAF code', async () => {
      await expect(
        publish('sync-priorite-secteur-vide', { sectorPriorities: [{ nafCode: 'C' } as never] }),
      ).rejects.toThrow(/priority|Priorité/)
      await expect(
        publish('sync-naf-espace', { sectorPriorities: [{ nafCode: 'C ', priority: 1 }] }),
      ).rejects.toThrow(/nafCode|Secteur/)
    })
  })
})
