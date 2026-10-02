import { describe, it, expect } from 'vitest'
import type { CanonicalProjectInput } from '@tee-backoffice/canonical'
import { CanonicalProjectToPayloadMapper } from '@/services/canonical/to-payload/CanonicalProjectToPayloadMapper'
import type { ProjectRelations } from '@/services/canonical/to-payload/ProjectRelations'
import type { MarkdownToRichText } from '@/services/canonical/rich-text/MarkdownToRichText'
import { richText } from './support/canonicalProgramFixtures'

const PROGRAM_A = 'prog0000000000000000000a'
const PROGRAM_B = 'prog0000000000000000000b'
const PROGRAM_UNKNOWN = 'prog0000000000000000000x'
const PROJECT_A = 'proj0000000000000000000a'
const PROJECT_UNKNOWN = 'proj0000000000000000000x'

class StubMarkdownToRichText implements MarkdownToRichText {
  convert(markdown: string) {
    return richText(markdown)
  }
}

class StubRelations implements ProjectRelations {
  programIdByCanonicalId(canonicalId: string) {
    return ({ [PROGRAM_A]: 1, [PROGRAM_B]: 2 } as Record<string, number>)[canonicalId]
  }
  projectIdByCanonicalId(canonicalId: string) {
    return ({ [PROJECT_A]: 10 } as Record<string, number>)[canonicalId]
  }
}

const mapper = new CanonicalProjectToPayloadMapper(new StubMarkdownToRichText(), new StubRelations())

const base: CanonicalProjectInput = {
  id: 'a1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'plan-action-energie',
  source: 'INTERNE',
  date_mise_a_jour: '2026-01-01T00:00:00+00:00',
  statut_projet: 'valide',
  titre: "Plan d'action énergie",
  nom_court: 'plan énergie',
  description_courte: 'Les postes les plus consommateurs.',
  description_longue: { contenu: 'Description longue.' },
  theme_principal: 'energie',
}

const map = (overrides: Partial<CanonicalProjectInput> = {}) => mapper.map({ ...base, ...overrides })

describe('CanonicalProjectToPayloadMapper', () => {
  it('maps the identity and publishes the project', () => {
    const { data, warnings } = map()
    expect(data).toMatchObject({
      canonicalId: base.id,
      slug: 'plan-action-energie',
      title: "Plan d'action énergie",
      nameTag: 'plan énergie',
      shortDescription: 'Les postes les plus consommateurs.',
      longDescription: richText('Description longue.'),
      mainTheme: 'energy',
      _status: 'published',
    })
    expect(warnings).toEqual([])
  })

  it('leaves the image and the linked projects to the importer', () => {
    const { data } = map({
      image: { url: 'https://assets.test/images/a.webp', chemin_source: '/images/a.webp' },
      projets_lies: { projets: [PROJECT_A] },
    })
    expect(data).not.toHaveProperty('image')
    expect(data).not.toHaveProperty('linkedProjects')
  })

  it('writes every absent field empty, so an update clears what upstream dropped', () => {
    expect(map().data).toMatchObject({
      titleLongDescription: null,
      titleMoreDescription: null,
      moreDescription: null,
      titleFaq: null,
      faqs: [],
      themes: [],
      sectors: [],
      highlightPriority: null,
      defaultPriority: null,
      sectorPriorities: [],
      programs: [],
      titleLinkedProjects: null,
      descriptionLinkedProjects: null,
      metaTitle: null,
      metaDescription: null,
    })
  })

  it('maps the titled descriptions and the SEO fields', () => {
    const { data } = map({
      description_longue: { titre: 'En bref', contenu: 'Longue.' },
      description_complementaire: { titre: 'Pour aller plus loin', contenu: 'Complément.' },
      seo: { titre: 'Titre SEO', description: 'Description SEO' },
    })
    expect(data).toMatchObject({
      titleLongDescription: 'En bref',
      longDescription: richText('Longue.'),
      titleMoreDescription: 'Pour aller plus loin',
      moreDescription: richText('Complément.'),
      metaTitle: 'Titre SEO',
      metaDescription: 'Description SEO',
    })
  })

  it('translates the themes back to the Payload vocabulary', () => {
    const { data } = map({ theme_principal: 'ecoconception', themes: ['energie', 'ecoconception', 'dechets'] })
    expect(data.mainTheme).toBe('eco-design')
    expect(data.themes).toEqual(['energy', 'eco-design', 'waste'])
  })

  it('fails loudly on a missing main theme', () => {
    expect(() => map({ theme_principal: undefined as never })).toThrow('thème principal non géré')
  })

  it('maps the FAQ, answers as rich text', () => {
    const { data } = map({
      faq: { titre: 'Questions fréquentes', questions: [{ question: 'Combien ?', reponse: 'Cela **dépend**.' }] },
    })
    expect(data.titleFaq).toBe('Questions fréquentes')
    expect(data.faqs).toEqual([{ question: 'Combien ?', answer: richText('Cela **dépend**.') }])
  })

  it('maps the priorities, a missing highlight staying empty rather than 0', () => {
    const { data } = map({
      priorite: { defaut: 40, par_secteur: [{ code_naf: '55.3', priorite: 1 }, { code_naf: 'C', priorite: 2 }] },
    })
    expect(data.defaultPriority).toBe(40)
    expect(data.highlightPriority).toBeNull()
    expect(data.sectorPriorities).toEqual([
      { nafCode: '55.3', priority: 1 },
      { nafCode: 'C', priority: 2 },
    ])
    expect(map({ priorite: { mise_en_avant: 5 } }).data.highlightPriority).toBe(5)
  })

  it('keeps the NAF sections and reports a code the Payload field cannot hold', () => {
    const { data, warnings } = map({ secteurs: ['A', 'C', '55.3'] })
    expect(data.sectors).toEqual(['A', 'C'])
    expect(warnings).toEqual(['secteur(s) hors sections NAF sans équivalent Payload : 55.3'])
  })

  it('resolves the programs in order and reports an unknown one', () => {
    const { data, warnings } = map({ dispositifs: [PROGRAM_B, PROGRAM_UNKNOWN, PROGRAM_A] })
    expect(data.programs).toEqual([2, 1])
    expect(warnings).toEqual([`dispositif introuvable dans le CMS : ${PROGRAM_UNKNOWN}`])
  })

  it('names an unresolved reference with the label it is given', () => {
    const labelled = new CanonicalProjectToPayloadMapper(new StubMarkdownToRichText(), new StubRelations(), (id) =>
      id === PROGRAM_UNKNOWN ? 'aide-disparue' : id,
    )
    expect(labelled.map({ ...base, dispositifs: [PROGRAM_UNKNOWN] }).warnings).toEqual([
      'dispositif introuvable dans le CMS : aide-disparue',
    ])
  })

  it('maps the linked projects title and description', () => {
    const { data } = map({ projets_lies: { titre: 'À voir aussi', description: 'Les prérequis', projets: [] } })
    expect(data).toMatchObject({ titleLinkedProjects: 'À voir aussi', descriptionLinkedProjects: 'Les prérequis' })
  })

  it('resolves the linked projects apart, reporting an unknown one', () => {
    const input = { ...base, projets_lies: { projets: [PROJECT_A, PROJECT_UNKNOWN] } }
    expect(mapper.mapLinkedProjects(input)).toEqual({
      linkedProjects: [10],
      warnings: [`projet lié introuvable dans le CMS : ${PROJECT_UNKNOWN}`],
    })
    expect(mapper.mapLinkedProjects(base)).toEqual({ linkedProjects: [], warnings: [] })
  })

  it('publishes a live project, without replacement', () => {
    expect(map().data).toMatchObject({ workflowStatus: 'publie', replacedBy: null, _status: 'published' })
  })

  it('keeps a redirected project replaced, pointing at its replacement', () => {
    const { data } = map({ statut_projet: 'remplace', remplace_par: PROJECT_A })
    expect(data).toMatchObject({ workflowStatus: 'remplace', replacedBy: 10, _status: 'draft' })
  })

  it('refuses a replaced project whose replacement the CMS does not have', () => {
    expect(() => map({ statut_projet: 'remplace', remplace_par: PROJECT_UNKNOWN })).toThrow(
      'projet remplaçant introuvable dans le CMS',
    )
  })
})
