import { describe, it, expect, vi } from 'vitest'
import { CanonicalProjectValidator } from '@tee-backoffice/canonical'
import { ProjectCanonicalMapper } from '@/services/canonical/ProjectCanonicalMapper'
import type { RichTextToMarkdown } from '@/services/canonical/rich-text/RichTextToMarkdown'
import type { Media, Program, Project } from '../../payload-types'
import { CUID, StubRichTextToMarkdown, TIMESTAMP, buildProgram, richText } from './support/canonicalProgramFixtures'

const LINKED_CUID = 'b1b2c3d4e5f6g7h8i9j0klmn'
const PROGRAM_CUID = 'c1b2c3d4e5f6g7h8i9j0klmn'

const mapper = new ProjectCanonicalMapper(new StubRichTextToMarkdown())
const validator = new CanonicalProjectValidator()

/** A minimal, valid Payload project with all required fields populated. */
function buildProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    canonicalId: CUID,
    slug: 'isolation-batiment',
    title: 'Isoler son bâtiment',
    nameTag: 'Isolation',
    shortDescription: 'Réduire les pertes de chaleur',
    longDescription: richText('Une isolation performante réduit la facture.'),
    mainTheme: 'building',
    _status: 'published',
    updatedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    ...overrides,
  } as Project
}

function buildMedia(overrides: Partial<Media> = {}): Media {
  return {
    id: 7,
    alt: 'Isolation',
    category: 'project-image',
    url: '/api/media/file/isolation.webp',
    updatedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    ...overrides,
  }
}

/** Maps then validates, failing the test with readable errors on invalid output. */
function mapAndValidate(project: Project) {
  const result = validator.validate(mapper.map(project))
  if (!result.success) {
    throw new Error(`canonical validation failed: ${JSON.stringify(result.errors, null, 2)}`)
  }
  return result.project.toJSON()
}

describe('ProjectCanonicalMapper', () => {
  describe('minimal project', () => {
    it('produces a valid canonical project', () => {
      const data = mapAndValidate(buildProject())
      expect(data).toEqual({
        id: CUID,
        slug: 'isolation-batiment',
        source: 'INTERNE',
        date_mise_a_jour: TIMESTAMP,
        statut_projet: 'valide',
        titre: 'Isoler son bâtiment',
        nom_court: 'Isolation',
        description_courte: 'Réduire les pertes de chaleur',
        description_longue: { contenu: 'Une isolation performante réduit la facture.' },
        theme_principal: 'batiment',
      })
    })

    it('never writes an empty optional block', () => {
      const input = mapper.map(
        buildProject({
          themes: [],
          sectors: [],
          faqs: [],
          sectorPriorities: [],
          programs: [],
          linkedProjects: [],
          metaTitle: ' ',
          titleFaq: 'Titre sans question',
        }),
      )
      for (const key of [
        'image',
        'description_complementaire',
        'themes',
        'secteurs',
        'priorite',
        'dispositifs',
        'projets_lies',
        'faq',
        'seo',
      ] as const) {
        expect(input[key], key).toBeUndefined()
      }
    })

    it('leaves a project without canonical id or long description to be refused by validation', () => {
      expect(validator.validate(mapper.map(buildProject({ canonicalId: null }))).success).toBe(false)
      expect(validator.validate(mapper.map(buildProject({ longDescription: richText('') }))).success).toBe(false)
    })
  })

  describe('content', () => {
    it('delegates rich text conversion to the markdown port', () => {
      const richTextPort: RichTextToMarkdown = { convert: vi.fn().mockReturnValue('converted') }
      const project = buildProject({
        moreDescription: richText('more'),
        faqs: [{ question: 'Pourquoi ?', answer: richText('answer') }],
      })
      const input = new ProjectCanonicalMapper(richTextPort).map(project)

      expect(richTextPort.convert).toHaveBeenCalledWith(project.longDescription)
      expect(input.description_longue.contenu).toBe('converted')
      expect(input.description_complementaire?.contenu).toBe('converted')
      expect(input.faq?.questions[0]?.reponse).toBe('converted')
    })

    it('carries the titles of the long and complementary descriptions', () => {
      const data = mapAndValidate(
        buildProject({
          titleLongDescription: 'En détail',
          titleMoreDescription: 'Pour aller plus loin',
          moreDescription: richText('Des aides existent.'),
        }),
      )
      expect(data.description_longue).toEqual({
        titre: 'En détail',
        contenu: 'Une isolation performante réduit la facture.',
      })
      expect(data.description_complementaire).toEqual({ titre: 'Pour aller plus loin', contenu: 'Des aides existent.' })
    })

    it('omits a complementary description whose Markdown is blank', () => {
      const blankValue = richText('blank')
      const blank: RichTextToMarkdown = { convert: (value) => (value === blankValue ? '  \n' : 'texte') }
      const input = new ProjectCanonicalMapper(blank).map(
        buildProject({ titleMoreDescription: 'Titre orphelin', moreDescription: blankValue }),
      )
      expect(input.description_complementaire).toBeUndefined()
    })

    it('maps the themes to the French taxonomy', () => {
      const data = mapAndValidate(buildProject({ mainTheme: 'eco-design', themes: ['energy', 'waste'] }))
      expect(data.theme_principal).toBe('ecoconception')
      expect(data.themes).toEqual(['energie', 'dechets'])
    })

    it('carries the sectors and the SEO fields', () => {
      const data = mapAndValidate(buildProject({ sectors: ['C', 'F'], metaTitle: 'SEO' }))
      expect(data.secteurs).toEqual(['C', 'F'])
      expect(data.seo).toEqual({ titre: 'SEO' })
    })
  })

  describe('image', () => {
    it('carries the url and the upstream path of an imported image', () => {
      const data = mapAndValidate(
        buildProject({ image: buildMedia({ sourcePath: '/images/projet/isolation.webp' }) }),
      )
      expect(data.image).toEqual({
        url: '/api/media/file/isolation.webp',
        chemin_source: '/images/projet/isolation.webp',
      })
    })

    it('omits the upstream path of a manual upload', () => {
      const data = mapAndValidate(buildProject({ image: buildMedia({ url: 'https://bucket.example/isolation.webp' }) }))
      expect(data.image).toEqual({ url: 'https://bucket.example/isolation.webp' })
    })

    it('omits an image left unpopulated or without url', () => {
      expect(mapper.map(buildProject({ image: 7 })).image).toBeUndefined()
      expect(mapper.map(buildProject({ image: buildMedia({ url: null }) })).image).toBeUndefined()
    })
  })

  describe('priorities', () => {
    it('maps the default, highlight and per-sector priorities', () => {
      const data = mapAndValidate(
        buildProject({
          defaultPriority: 0,
          highlightPriority: 3,
          sectorPriorities: [
            { nafCode: 'C', priority: 2 },
            { nafCode: '55.3', priority: 1 },
          ],
        }),
      )
      expect(data.priorite).toEqual({
        defaut: 0,
        mise_en_avant: 3,
        par_secteur: [
          { code_naf: 'C', priorite: 2 },
          { code_naf: '55.3', priorite: 1 },
        ],
      })
    })

    it('keeps only the priorities that are set', () => {
      expect(mapper.map(buildProject({ highlightPriority: 4 })).priorite).toEqual({ mise_en_avant: 4 })
    })
  })

  describe('relations', () => {
    it('references the populated programs by canonical id', () => {
      const programs: (number | Program)[] = [
        buildProgram({ canonicalId: PROGRAM_CUID }),
        42,
        buildProgram({ id: 2, canonicalId: null }),
      ]
      expect(mapAndValidate(buildProject({ programs })).dispositifs).toEqual([PROGRAM_CUID])
    })

    it('references the populated linked projects by canonical id', () => {
      const data = mapAndValidate(
        buildProject({
          titleLinkedProjects: 'À voir aussi',
          descriptionLinkedProjects: 'Des projets proches',
          linkedProjects: [buildProject({ id: 2, canonicalId: LINKED_CUID }), 3, buildProject({ id: 4, canonicalId: null })],
        }),
      )
      expect(data.projets_lies).toEqual({
        titre: 'À voir aussi',
        description: 'Des projets proches',
        projets: [LINKED_CUID],
      })
    })

    it('keeps the linked projects title even without any resolved project', () => {
      expect(mapAndValidate(buildProject({ titleLinkedProjects: 'À voir aussi', linkedProjects: [3] })).projets_lies).toEqual({
        titre: 'À voir aussi',
        projets: [],
      })
    })
  })

  describe('faq', () => {
    it('maps the questions with their Markdown answer', () => {
      const data = mapAndValidate(
        buildProject({
          titleFaq: 'Questions fréquentes',
          faqs: [
            { question: 'Combien ça coûte ?', answer: richText('Cela dépend de la surface.') },
            { question: 'Quelles aides ?', answer: richText('Plusieurs dispositifs.') },
          ],
        }),
      )
      expect(data.faq).toEqual({
        titre: 'Questions fréquentes',
        questions: [
          { question: 'Combien ça coûte ?', reponse: 'Cela dépend de la surface.' },
          { question: 'Quelles aides ?', reponse: 'Plusieurs dispositifs.' },
        ],
      })
    })

    it('drops a question whose answer is empty', () => {
      const data = mapAndValidate(
        buildProject({
          faqs: [
            { question: 'Sans réponse ?', answer: richText('') },
            { question: 'Avec réponse ?', answer: richText('Oui.') },
          ],
        }),
      )
      expect(data.faq).toEqual({ questions: [{ question: 'Avec réponse ?', reponse: 'Oui.' }] })
    })
  })

  describe('lifecycle', () => {
    it('flags a replaced project with the canonical id of its replacement', () => {
      const data = mapAndValidate(
        buildProject({
          slug: 'maintenance-préventive',
          workflowStatus: 'remplace',
          replacedBy: buildProject({ id: 2, canonicalId: LINKED_CUID, slug: 'maintenance-preventive' }),
        }),
      )
      expect(data).toMatchObject({ statut_projet: 'remplace', remplace_par: LINKED_CUID })
    })

    it('leaves a replaced project without a populated replacement to the validator', () => {
      const input = mapper.map(buildProject({ workflowStatus: 'remplace', replacedBy: 2 }))
      expect(input.statut_projet).toBe('remplace')
      expect(input.remplace_par).toBeUndefined()
      expect(validator.validate(input).success).toBe(false)
    })

    it('ignores the replacement of a project that is not replaced', () => {
      const data = mapAndValidate(
        buildProject({ workflowStatus: 'publie', replacedBy: buildProject({ id: 2, canonicalId: LINKED_CUID }) }),
      )
      expect(data.statut_projet).toBe('valide')
      expect(data.remplace_par).toBeUndefined()
    })
  })
})
