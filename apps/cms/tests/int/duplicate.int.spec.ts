// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { afterAll, describe, it, beforeAll, expect } from 'vitest'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  cuid2Schema,
  slugSchema,
  type CanonicalProgramRepository,
  type CanonicalProjectRepository,
} from '@tee-backoffice/canonical'
import type { Program, Project, User } from '../../payload-types'
import { ProgramsSync } from '@/scripts/sync/programs/ProgramsSync'
import { getCanonicalProjectRepository } from '@/services/canonical/canonicalProjectRepository'
import { getCanonicalProgramRepository } from '@/services/canonical/canonicalRepository'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

const programsFixture = resolve(fileURLToPath(new URL('../fixtures', import.meta.url)), 'programs.json')

let payload: Payload
let admin: User
let creator: User
let programCanonical: CanonicalProgramRepository
let projectCanonical: CanonicalProjectRepository
// Each test takes its own published program, so the tests stay independent.
let published: Program[]

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

const publishProject = (slug: string) =>
  payload.create({
    collection: 'projects',
    data: {
      slug,
      title: `Titre ${slug}`,
      nameTag: slug,
      shortDescription: 'Description courte',
      longDescription: richText('Description longue'),
      mainTheme: 'energy',
      workflowStatus: 'publie',
    },
  })

// The copies are deleted at the end: the other suites read the published programs of the fixture.
const copies: { collection: 'projects' | 'programs'; id: number }[] = []

const duplicate = async <TSlug extends 'projects' | 'programs'>(
  collection: TSlug,
  id: number,
  user: User,
  options: { draft?: boolean; data?: { _status: 'draft' | 'published' } } = {},
) => {
  const copy = await payload.duplicate({
    collection,
    id,
    user,
    overrideAccess: false,
    depth: 0,
    draft: options.draft,
    data: options.data as never,
  })
  copies.push({ collection, id: copy.id })
  return copy
}

// What the admin "Duplicate" action sends: `POST /:collection/:id/duplicate`,
// where the REST handler defaults `draft` to true, with `{ _status: 'draft' }` as body.
const duplicateFromAdmin = <TSlug extends 'projects' | 'programs'>(collection: TSlug, id: number, user: User) =>
  duplicate(collection, id, user, { draft: true, data: { _status: 'draft' } })

const updateProgram = (id: number, data: Partial<Program>, user: User) =>
  payload.update({ collection: 'programs', id, data, user, overrideAccess: false, depth: 0 })

const expectFreshIdentity = (copy: { canonicalId?: string | null; slug?: string | null }, source: Program | Project) => {
  expect(cuid2Schema.safeParse(copy.canonicalId).success).toBe(true)
  expect(copy.canonicalId).not.toBe(source.canonicalId)
  expect(slugSchema.safeParse(copy.slug).success).toBe(true)
}

const expectNewDraftProgram = (copy: Program, source: Program, user: User) => {
  expectFreshIdentity(copy, source)
  expect(copy.workflowStatus).toBe('en-creation')
  expect(copy._status).toBe('draft')
  expect(copy.workflowHistory ?? []).toEqual([])
  expect(copy.replacedBy ?? null).toBeNull()
  expect(copy.lastModifiedBy).toBe(user.id)
  expect(copy.title).toBe(`${String(source.title)} (copie)`)
}

describe('duplicating a document', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await ProgramsSync.fromFile(payload, programsFixture).run()
    programCanonical = await getCanonicalProgramRepository(payload.logger)
    projectCanonical = await getCanonicalProjectRepository(payload.logger)

    published = (
      await payload.find({ collection: 'programs', where: { workflowStatus: { equals: 'publie' } }, limit: 5, depth: 0 })
    ).docs
    expect(published).toHaveLength(5)

    admin = await payload.create({
      collection: 'users',
      data: { email: 'duplicator-admin@tee.test', password: 'duplicator-admin@tee.test', role: 'admin' },
    })
    creator = await payload.create({
      collection: 'users',
      data: {
        email: 'duplicator-creator@tee.test',
        password: 'duplicator-creator@tee.test',
        role: 'creator',
        // A creator reads the programs of their operator.
        operator: published[1]!.operator as number,
      },
      depth: 0,
    })
  }, 60_000)

  afterAll(async () => {
    for (const { collection, id } of copies) await payload.delete({ collection, id })
  })

  describe('a project', () => {
    it('copies a published project as a draft with its own identity, kept out of the canonical', async () => {
      const source = await publishProject('duplication-projet')

      const copy = await duplicate('projects', source.id, admin)

      expect(copy._status).toBe('draft')
      expect(copy.slug).toBe('duplication-projet-copy')
      expect(copy.title).toBe(`${source.title} (copie)`)
      expectFreshIdentity(copy, source)
      expect(await projectCanonical.findBySlug(copy.slug)).toBeNull()
      expect((await projectCanonical.findBySlug(source.slug))?.id).toBe(source.canonicalId)
    })

    it('publishes the copy as is, under its own canonical id', async () => {
      const source = await publishProject('duplication-projet-publiee')
      const copy = await duplicateFromAdmin('projects', source.id, admin)
      expect(copy._status).toBe('draft')

      await payload.update({
        collection: 'projects',
        id: copy.id,
        data: { workflowStatus: 'publie' },
        user: admin,
        overrideAccess: false,
      })

      expect((await projectCanonical.findBySlug(copy.slug))?.id).toBe(copy.canonicalId)
      expect((await projectCanonical.findBySlug(source.slug))?.id).toBe(source.canonicalId)
    })

    it('never publishes the copy, even when the caller asks for it', async () => {
      const source = await publishProject('duplication-projet-forcee')

      const copy = await duplicate('projects', source.id, admin, { draft: false, data: { _status: 'published' } })

      expect(copy._status).toBe('draft')
      expect(await projectCanonical.findBySlug(copy.slug)).toBeNull()
    })

    it('numbers the slug of the next copies of the same project', async () => {
      const source = await publishProject('duplication-projet-multiple')

      const slugs: string[] = []
      for (let count = 0; count < 3; count++) slugs.push((await duplicate('projects', source.id, admin)).slug)

      expect(slugs).toEqual([
        'duplication-projet-multiple-copy',
        'duplication-projet-multiple-copy-2',
        'duplication-projet-multiple-copy-3',
      ])
    })
  })

  describe('a program', () => {
    it('copies a published program back to "en-creation", kept out of the canonical', async () => {
      const source = published[0]!
      await payload.create({
        collection: 'review-comments',
        data: { program: source.id, text: 'Commentaire sur l’original', author: admin.id },
        user: admin,
      })

      const copy = await duplicate('programs', source.id, admin)

      expectNewDraftProgram(copy, source, admin)
      expect(copy.slug).toBe(`${source.slug}-copy`)
      expect(copy.assignedContributors ?? []).toEqual([])
      expect(await programCanonical.findBySlug(copy.slug)).toBeNull()
      expect((await programCanonical.findBySlug(source.slug))?.id).toBe(source.canonicalId)

      const comments = await payload.find({ collection: 'review-comments', where: { program: { equals: copy.id } } })
      expect(comments.totalDocs).toBe(0)
      const original = await payload.findByID({ collection: 'programs', id: source.id, depth: 0 })
      expect(original.workflowStatus).toBe('publie')
      expect(original.updatedAt).toBe(source.updatedAt)
    })

    it('takes the copy through the workflow, then stores it under its own canonical id', async () => {
      const source = published[0]!
      const copy = await duplicateFromAdmin('programs', source.id, admin)
      expectNewDraftProgram(copy, source, admin)
      expect(copy.slug).toBe(`${source.slug}-copy-2`)

      await updateProgram(copy.id, { workflowStatus: 'en-relecture' }, admin)
      const live = await updateProgram(copy.id, { workflowStatus: 'en-cours-publication' }, admin)

      expect(live.workflowStatus).toBe('publie')
      expect(live.workflowHistory?.map((entry) => entry.to)).toEqual(['en-relecture', 'publie'])
      expect((await programCanonical.findBySlug(copy.slug))?.id).toBe(copy.canonicalId)
      expect((await programCanonical.findBySlug(source.slug))?.id).toBe(source.canonicalId)
    })

    it('lets a creator copy a published program they can read, as their own draft', async () => {
      const source = await payload.update({
        collection: 'programs',
        id: published[1]!.id,
        data: { metaTitle: 'Titre SEO' },
        context: SystemWorkflowContext.create(),
        depth: 0,
      })

      const copy = await duplicate('programs', source.id, creator)

      expectNewDraftProgram(copy, source, creator)
      expect(copy.assignedContributors).toEqual([creator.id])
      expect(copy.operator).toBe(source.operator)
      // Admin-only fields are not handed to a creator, while an admin keeps them.
      expect(copy.metaTitle ?? null).toBeNull()
      expect((await duplicate('programs', source.id, admin)).metaTitle).toBe('Titre SEO')
      // The creator can then work on the copy and ask for a review.
      const reviewed = await updateProgram(copy.id, { workflowStatus: 'en-relecture' }, creator)
      expect(reviewed.workflowStatus).toBe('en-relecture')
      expect(await programCanonical.findBySlug(copy.slug)).toBeNull()
    })

    it('refuses a creator copying a program they cannot read', async () => {
      const foreign = published.find((program) => program.operator !== creator.operator)
      if (!foreign) throw new Error('no program of another operator in the fixture')

      await expect(duplicate('programs', foreign.id, creator)).rejects.toThrow()
    })

    it('copies an archived program back to "en-creation", leaving the archived row in the canonical', async () => {
      const source = published[2]!
      await payload.update({
        collection: 'programs',
        id: source.id,
        data: { workflowStatus: 'archive' },
        context: SystemWorkflowContext.create(),
      })

      const copy = await duplicate('programs', source.id, admin)

      expectNewDraftProgram(copy, source, admin)
      expect(await programCanonical.findBySlug(copy.slug)).toBeNull()
      expect((await programCanonical.findBySlug(source.slug))?.statutDispositif).toBe('archive')
    })

    it('does not carry the replacement nor the history of a replaced program', async () => {
      const source = published[3]!
      await payload.update({
        collection: 'programs',
        id: source.id,
        data: { workflowStatus: 'remplace', replacedBy: published[4]!.id },
        user: admin,
        overrideAccess: false,
      })

      const copy = await duplicate('programs', source.id, admin)

      expectNewDraftProgram(copy, source, admin)
      expect((await programCanonical.findBySlug(source.slug))?.statutDispositif).toBe('remplace')
    })
  })
})
