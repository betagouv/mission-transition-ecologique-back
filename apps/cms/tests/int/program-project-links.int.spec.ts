// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect } from 'vitest'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import type { CanonicalProjectRepository } from '@tee-backoffice/canonical'
import type { Program, Project, User } from '../../payload-types'
import { ProgramsSync } from '@/scripts/sync/programs/ProgramsSync'
import { getCanonicalProjectRepository } from '@/services/canonical/canonicalProjectRepository'
import { ProgramProjectLinks } from '@/services/programs/ProgramProjectLinks'

const programsFixture = resolve(fileURLToPath(new URL('../fixtures', import.meta.url)), 'programs.json')

let payload: Payload
let canonical: CanonicalProjectRepository
let programA: Program
let programB: Program
let admin: User
let creator: User

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

// Each test works on its own project: the programs are shared with the other test files.
const publishProject = (slug: string, programs: number[] = []) =>
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
      programs,
    },
    depth: 0,
  })

const linkedProjectsOf = async (programId: number) =>
  ProgramProjectLinks.ids(
    (await payload.findByID({ collection: 'programs', id: programId, depth: 0, draft: true })).linkedProjects,
  )

// What the admin form sends: the whole selection, the projects of the other tests included.
const setLinkedProjects = (programId: number, linkedProjects: number[], user: User, draft = false) =>
  payload.update({
    collection: 'programs',
    id: programId,
    data: { linkedProjects },
    draft,
    user,
    overrideAccess: false,
    depth: 0,
  })

const latestProject = (id: number) => payload.findByID({ collection: 'projects', id, depth: 0, draft: true })
const publishedProject = (id: number) => payload.findByID({ collection: 'projects', id, depth: 0, draft: false })

describe('projects of a program', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await ProgramsSync.fromFile(payload, programsFixture).run()
    canonical = await getCanonicalProjectRepository(payload.logger)

    const published = (
      await payload.find({ collection: 'programs', where: { workflowStatus: { equals: 'publie' } }, limit: 2, depth: 0 })
    ).docs
    expect(published).toHaveLength(2)
    programA = published[0]!
    programB = published[1]!

    admin = await payload.create({
      collection: 'users',
      data: { email: 'links-admin@tee.test', password: 'links-admin@tee.test', role: 'admin' },
    })
    creator = await payload.create({
      collection: 'users',
      data: {
        email: 'links-creator@tee.test',
        password: 'links-creator@tee.test',
        role: 'creator',
        operator: programA.operator as number,
      },
      depth: 0,
    })
  }, 60_000)

  it('are the projects that list the program', async () => {
    const project = await publishProject('liens-lecture', [programA.id])

    expect(await linkedProjectsOf(programA.id)).toContain(project.id)
    expect(await linkedProjectsOf(programB.id)).not.toContain(project.id)
  })

  it('are left out of a list of programs', async () => {
    await publishProject('liens-liste', [programA.id])

    const listed = await payload.find({ collection: 'programs', where: { id: { equals: programA.id } }, depth: 0 })

    expect(listed.docs[0]?.linkedProjects ?? []).toEqual([])
  })

  it('follow a change made on the project', async () => {
    const project = await publishProject('liens-cote-projet', [programA.id])

    await payload.update({ collection: 'projects', id: project.id, data: { programs: [programB.id] }, user: admin })

    expect(await linkedProjectsOf(programA.id)).not.toContain(project.id)
    expect(await linkedProjectsOf(programB.id)).toContain(project.id)
  })

  it('are written to the projects when picked on the program, and reach the canonical', async () => {
    const project = await publishProject('liens-ajout')
    const before = await linkedProjectsOf(programA.id)

    const saved = await setLinkedProjects(programA.id, [...before, project.id], admin)

    expect(saved.linkedProjects).toContain(project.id)
    expect((await publishedProject(project.id)).programs).toEqual([programA.id])
    expect((await canonical.findBySlug('liens-ajout'))?.toJSON().dispositifs).toEqual([programA.canonicalId])
    expect((await payload.findByID({ collection: 'programs', id: programA.id, depth: 0 })).workflowStatus).toBe('publie')
  })

  it('lose a project removed from the selection, its other programs kept', async () => {
    const project = await publishProject('liens-retrait', [programA.id, programB.id])
    const before = await linkedProjectsOf(programA.id)

    await setLinkedProjects(programA.id, before.filter((id) => id !== project.id), admin)

    expect(await linkedProjectsOf(programA.id)).not.toContain(project.id)
    expect((await publishedProject(project.id)).programs).toEqual([programB.id])
  })

  it('leave the other projects untouched', async () => {
    const kept = await publishProject('liens-conserve', [programA.id])
    const added = await publishProject('liens-autre')
    const before = await linkedProjectsOf(programA.id)

    await setLinkedProjects(programA.id, [...before, added.id], admin)

    expect((await publishedProject(kept.id)).updatedAt).toBe(kept.updatedAt)
  })

  it('are applied when the program is only saved as a draft', async () => {
    const project = await publishProject('liens-brouillon-dispositif')
    const before = await linkedProjectsOf(programB.id)

    await setLinkedProjects(programB.id, [...before, project.id], admin, true)

    expect((await publishedProject(project.id)).programs).toEqual([programB.id])
  })

  it('never publish the pending draft of a project', async () => {
    const project = await publishProject('liens-projet-en-cours')
    await payload.update({
      collection: 'projects',
      id: project.id,
      data: { title: 'Titre en cours de réécriture' },
      draft: true,
      user: admin,
    })
    const before = await linkedProjectsOf(programA.id)

    await setLinkedProjects(programA.id, [...before, project.id], admin)

    expect(await publishedProject(project.id)).toMatchObject({ title: project.title, programs: [] })
    expect(await latestProject(project.id)).toMatchObject({
      title: 'Titre en cours de réécriture',
      workflowStatus: 'en-cours-modification',
      programs: [programA.id],
    })
    expect(await linkedProjectsOf(programA.id)).toContain(project.id)
  })

  it('are not copied with the program, and a creator cannot pick them', async () => {
    const project = await publishProject('liens-createur', [programA.id])

    const copy = await payload.duplicate({
      collection: 'programs',
      id: programA.id,
      user: creator,
      overrideAccess: false,
      depth: 0,
      draft: true,
      data: { _status: 'draft' } as never,
    })
    expect(copy.linkedProjects ?? []).toEqual([])

    await setLinkedProjects(copy.id, [project.id], creator, true)

    expect(await linkedProjectsOf(copy.id)).toEqual([])
    expect((await publishedProject(project.id)).programs).toEqual([programA.id])
    await payload.delete({ collection: 'programs', id: copy.id })
  })
})
