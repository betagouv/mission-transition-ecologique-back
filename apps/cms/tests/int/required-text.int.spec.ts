// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { afterAll, describe, it, beforeAll, expect } from 'vitest'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import type { Program, Project } from '../../payload-types'
import { ProgramsSeed } from '@/scripts/seed/programs'
import { getCanonicalProjectRepository } from '@/services/canonical/canonicalProjectRepository'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

const programsFixture = resolve(fileURLToPath(new URL('../fixtures', import.meta.url)), 'programs.json')

let payload: Payload
let program: Program

const paragraph = (text: string) => ({
  type: 'paragraph',
  version: 1,
  children: [{ type: 'text', text, format: 0, version: 1 }],
})

const richText = (...paragraphs: string[]): Project['longDescription'] => ({
  root: { type: 'root', children: paragraphs.map(paragraph), direction: 'ltr', format: '', indent: 0, version: 1 },
})

const project = (slug: string, overrides: Partial<Project>, draft = false) =>
  payload.create({
    collection: 'projects',
    draft,
    data: {
      slug,
      title: `Titre ${slug}`,
      nameTag: slug,
      shortDescription: 'Description courte',
      longDescription: richText('Description longue'),
      mainTheme: 'energy',
      _status: draft ? 'draft' : 'published',
      ...overrides,
    },
  })

const updateProgram = (data: Partial<Program>, draft = false) =>
  payload.update({ collection: 'programs', id: program.id, data, draft, context: SystemWorkflowContext.create() })

// Payload names the refused field by its label, last segment of the path.
const invalidField = (label: string) => new RegExp(`${label}$`)

describe('required texts made of whitespace', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await ProgramsSeed.fromFile(payload, programsFixture).run()
    const published = (
      await payload.find({ collection: 'programs', where: { workflowStatus: { equals: 'publie' } }, limit: 1, depth: 0 })
    ).docs[0]!
    // A valid program of its own, so the fixture programs the other suites read stay untouched.
    program = await payload.duplicate({
      collection: 'programs',
      id: published.id,
      data: { slug: 'texte-vide-dispositif' },
      depth: 0,
    })
  }, 60_000)

  afterAll(async () => {
    await payload.delete({ collection: 'programs', id: program.id })
  })

  describe('on a project', () => {
    it.each([
      ['title', 'Titre', { title: '   ' }],
      ['nameTag', 'Nom court', { nameTag: '\t' }],
      ['shortDescription', 'Description courte', { shortDescription: ' \n ' }],
      ['faqs.question', 'Question', { faqs: [{ question: '  ', answer: richText('Réponse') }] }],
      ['longDescription', 'Description longue', { longDescription: richText('   ') }],
      ['longDescription made of empty paragraphs', 'Description longue', { longDescription: richText('', '') }],
      ['faqs.answer', 'Réponse', { faqs: [{ question: 'Combien ?', answer: richText(' ') }] }],
    ] satisfies [string, string, Partial<Project>][])(
      'refuses to publish a blank %s',
      async (field, label, overrides) => {
        const slug = `texte-vide-${field.replace(/\W/g, '-').toLowerCase()}`

        await expect(project(slug, overrides)).rejects.toThrow(invalidField(label))
        expect(await (await getCanonicalProjectRepository(payload.logger)).findBySlug(slug)).toBeNull()
      },
    )

    it('lets a draft carry a blank title, then refuses to publish it', async () => {
      const draft = await project('texte-vide-brouillon', { title: '   ' }, true)
      expect(draft._status).toBe('draft')

      await expect(
        payload.update({ collection: 'projects', id: draft.id, data: { _status: 'published' } }),
      ).rejects.toThrow(invalidField('Titre'))
      const live = await payload.update({
        collection: 'projects',
        id: draft.id,
        data: { title: 'Titre renseigné', _status: 'published' },
      })
      expect(live._status).toBe('published')
    })

    it('keeps accepting surrounding whitespace and blank optional texts', async () => {
      const live = await project('texte-optionnel-vide', { title: ' Titre entouré ', titleFaq: '   ' })
      expect(live.title).toBe(' Titre entouré ')
    })
  })

  describe('on a program', () => {
    it.each([
      ['title', 'Titre', { title: '   ' }],
      ['promise', 'Promesse', { promise: ' ' }],
      ['otherCriteria.value', "Critère d'éligibilité", { otherCriteria: [{ value: '  ' }] }],
      ['description', 'Description', { description: richText('  ') }],
      ['steps.description', "Description de l'étape", { steps: [{ description: richText(' ') }] }],
    ] satisfies [string, string, Partial<Program>][])(
      'refuses a blank %s outside a draft',
      async (_field, label, data) => {
        await expect(updateProgram(data)).rejects.toThrow(invalidField(label))
      },
    )

    it('lets a draft carry a blank title', async () => {
      const draft = await updateProgram({ title: '   ' }, true)
      expect(draft.title).toBe('   ')
    })
  })
})
