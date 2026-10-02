import projectsFixture from '../../static/input/projects-tests.json'
import { LocalJsonSnapshot } from './LocalJsonSnapshot'
import { TeeProjectRecords } from './TeeProjectRecords'

const project = {
  id: 31,
  slug: 'diag-360',
  title: 'Diagnostic 360',
  nameTag: 'diag 360',
  shortDescription: 'Un état des lieux complet.',
  longDescription: 'Le **diagnostic** couvre tous les enjeux.',
  themes: ['environmental'],
  mainTheme: 'environmental',
}

describe('TeeProjectRecords', () => {
  it('renvoie tous les enregistrements bien formés', () => {
    const other = { ...project, id: 32, slug: 'bilan-carbone' }
    expect(TeeProjectRecords.parse([project, other])).toEqual({ projects: [project, other], rejected: [] })
  })

  it.each([
    ['title: null', { title: null }, 'title : '],
    ['themes en chaîne', { themes: 'environmental' }, 'themes : '],
    ['un projet lié par slug', { linkedProjects: ['diag-360'] }, 'linkedProjects.0 : '],
  ])('écarte un enregistrement hors forme (%s) sans toucher aux autres', (_label, over, reason) => {
    const { projects, rejected } = TeeProjectRecords.parse([{ ...project, slug: 'casse', ...over }, project])

    expect(projects).toEqual([project])
    expect(rejected).toEqual([{ index: 0, slug: 'casse', reason: expect.stringContaining(reason) }])
  })

  it('lit null ou une chaîne vide sur un champ optionnel comme une absence', () => {
    const upstream = {
      ...project,
      image: null,
      titleLongDescription: '',
      moreDescription: null,
      programs: null,
      linkedProjects: null,
      priority: null,
      highlightPriority: null,
      sectors: null,
      faqs: null,
      metaTitle: null,
    }

    const { projects, rejected } = TeeProjectRecords.parse([upstream])

    expect(rejected).toEqual([])
    expect(projects).toEqual([{ ...project, highlightPriority: null }])
  })

  it("garde les clés inconnues d'un enregistrement", () => {
    const upstream = { ...project, futur: 1, faqs: [{ id: 146, question: 'Q ?', answer: 'R.' }] }
    expect(TeeProjectRecords.parse([upstream]).projects).toEqual([upstream])
  })

  it.each([
    ['sans slug', { ...project, slug: undefined, title: null }],
    ['slug non textuel', { ...project, slug: 12 }],
    ["qui n'est pas un objet", 'diag-360'],
    ['null', null],
  ])('désigne par sa position un enregistrement %s', (_label, record) => {
    const { projects, rejected } = TeeProjectRecords.parse([project, record])

    expect(projects).toEqual([project])
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).not.toHaveProperty('slug')
    expect(TeeProjectRecords.describe(rejected[0])).toMatch(/^enregistrement n° 2 : /)
  })

  it('décrit un enregistrement écarté par son slug', () => {
    expect(TeeProjectRecords.describe({ index: 4, slug: 'casse', reason: 'title : Expected string, received null' })).toBe(
      'casse : title : Expected string, received null',
    )
  })

  it.each([{ projects: [project] }, null, 'projects', 42])("échoue franchement si le fichier n'est pas un tableau (%j)", (raw) => {
    expect(() => TeeProjectRecords.parse(raw)).toThrow('un tableau de projets est attendu')
  })

  it('accepte sans rien écarter les fichiers versionnés', () => {
    const snapshot = new LocalJsonSnapshot().read<unknown[]>('projects')

    expect(TeeProjectRecords.parse(projectsFixture).rejected).toEqual([])
    const { projects, rejected } = TeeProjectRecords.parse(snapshot)
    expect(rejected).toEqual([])
    expect(projects).toHaveLength(snapshot.length)
  })
})
