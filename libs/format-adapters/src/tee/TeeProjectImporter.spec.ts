import { CanonicalProjectValidator } from '@tee-backoffice/canonical'
import projectsFixture from '../../static/input/projects-tests.json'
import { LocalJsonSnapshot } from './LocalJsonSnapshot'
import { SlugCanonicalId } from './SlugCanonicalId'
import { TeeProjectImporter } from './TeeProjectImporter'
import { teeProjectsSchema } from './tee-project.schema'
import type { TeeProject } from './tee-project.schema'

const NOW = '2026-10-01T06:00:00+00:00'
const ASSETS = 'https://amont.example.org/public'

const makeProject = (over: Partial<TeeProject> = {}): TeeProject => ({
  id: 1,
  slug: 'projet-test',
  title: 'Projet test',
  nameTag: 'test',
  shortDescription: 'Une description courte.',
  longDescription: 'Une **description** longue.',
  themes: ['energy'],
  mainTheme: 'energy',
  ...over,
})

describe('TeeProjectImporter', () => {
  const validator = new CanonicalProjectValidator()
  const importer = new TeeProjectImporter({ assetsBaseUrl: ASSETS })
  const importOne = (project: TeeProject) => importer.importMany([project], NOW)[0]

  describe('projet minimal', () => {
    const input = importOne(makeProject())

    it('pose identité, statut et horodatage', () => {
      expect(input).toMatchObject({
        id: SlugCanonicalId.forProject('projet-test'),
        slug: 'projet-test',
        source: 'INTERNE',
        date_mise_a_jour: NOW,
        statut_projet: 'valide',
        titre: 'Projet test',
        nom_court: 'test',
        description_courte: 'Une description courte.',
        description_longue: { contenu: 'Une **description** longue.' },
        theme_principal: 'energie',
        themes: ['energie'],
      })
    })

    it("n'écrit aucun bloc optionnel vide", () => {
      for (const key of ['image', 'description_complementaire', 'secteurs', 'priorite', 'dispositifs', 'projets_lies', 'faq', 'seo']) {
        expect(input).not.toHaveProperty(key)
      }
      expect(validator.validate(input).success).toBe(true)
    })
  })

  it('omet les blocs dont tous les champs amont sont vides ou blancs', () => {
    const input = importOne(
      makeProject({
        image: '',
        moreDescription: '  \n',
        titleMoreDescription: 'Titre orphelin',
        sectors: [],
        programs: [],
        priority: {},
        highlightPriority: null,
        linkedProjects: [],
        descriptionLinkedProjects: '',
        titleFaq: 'FAQ sans question',
        faqs: [],
        metaTitle: ' ',
      }),
    )

    for (const key of ['image', 'description_complementaire', 'secteurs', 'priorite', 'dispositifs', 'projets_lies', 'faq', 'seo']) {
      expect(input).not.toHaveProperty(key)
    }
    expect(importer.warnings).toEqual([])
    expect(importer.unusableImagePaths.size).toBe(0)
  })

  it("construit l'URL de l'image sur la base des fichiers amont et garde le chemin source", () => {
    const input = importOne(makeProject({ image: '/images/projet/test.webp' }))
    expect(input.image).toEqual({
      url: 'https://amont.example.org/public/images/projet/test.webp',
      chemin_source: '/images/projet/test.webp',
    })
  })

  it("signale et omet une image dont le chemin sort du dossier public", () => {
    const input = importOne(makeProject({ image: '/images/../../secret.webp' }))
    expect(input).not.toHaveProperty('image')
    expect(importer.warnings).toEqual(["projet-test : chemin d'image invalide « /images/../../secret.webp »"])
  })

  describe("image amont inexploitable", () => {
    it.each(['images/projet/x.webp', '/images/../x.webp', '/images/projet/', ' /images/projet/x.webp'])(
      'garde la trace du chemin « %s » pour que l\'image actuelle soit conservée',
      (path) => {
        const input = importOne(makeProject({ image: path }))

        expect(input).not.toHaveProperty('image')
        expect(importer.unusableImagePaths).toEqual(new Map([['projet-test', path]]))
        expect(importer.warnings).toEqual([`projet-test : chemin d'image invalide « ${path} »`])
      },
    )

    it.each([undefined, '', '   '])("ne confond pas avec l'absence d'image en amont (%j)", (image) => {
      const input = importOne(makeProject({ image }))

      expect(input).not.toHaveProperty('image')
      expect(importer.unusableImagePaths.size).toBe(0)
      expect(importer.warnings).toEqual([])
    })

    it('repart de zéro à chaque lecture', () => {
      importOne(makeProject({ image: 'images/projet/x.webp' }))
      importOne(makeProject({ image: '/images/projet/x.webp' }))

      expect(importer.unusableImagePaths.size).toBe(0)
    })
  })

  it('porte les descriptions avec leur titre', () => {
    const input = importOne(
      makeProject({
        titleLongDescription: 'Pourquoi ?',
        titleMoreDescription: 'Pour aller plus loin',
        moreDescription: '- un lien',
      }),
    )
    expect(input.description_longue).toEqual({ titre: 'Pourquoi ?', contenu: 'Une **description** longue.' })
    expect(input.description_complementaire).toEqual({ titre: 'Pour aller plus loin', contenu: '- un lien' })
  })

  describe('thèmes', () => {
    it('traduit les thèmes amont vers la taxonomie pivot', () => {
      const input = importOne(makeProject({ mainTheme: 'eco-design', themes: ['eco-design', 'waste', 'biodiversite'] }))
      expect(input.theme_principal).toBe('ecoconception')
      expect(input.themes).toEqual(['ecoconception', 'dechets', 'biodiversite'])
    })

    it('laisse le thème principal absent quand il est inconnu : le projet est refusé, jamais deviné', () => {
      const input = importOne(makeProject({ mainTheme: 'climat' }))
      expect(input.theme_principal).toBeUndefined()
      expect(validator.validate(input).success).toBe(false)
      expect(importer.warnings).toEqual(['projet-test : thème principal inconnu « climat »'])
    })

    it('ignore et signale un thème secondaire inconnu', () => {
      const input = importOne(makeProject({ themes: ['energy', 'climat'] }))
      expect(input.themes).toEqual(['energie'])
      expect(importer.warnings).toEqual(['projet-test : thème(s) inconnu(s) ignoré(s) : climat'])
    })
  })

  describe('priorité', () => {
    it('sépare la priorité par défaut, la mise en avant et les secteurs triés', () => {
      const input = importOne(
        makeProject({ priority: { I: 2, default: 40, '56': 3, '55.3': 1, C: 2 }, highlightPriority: '5' }),
      )
      expect(input.priorite).toEqual({
        defaut: 40,
        mise_en_avant: 5,
        par_secteur: [
          { code_naf: '55.3', priorite: 1 },
          { code_naf: '56', priorite: 3 },
          { code_naf: 'C', priorite: 2 },
          { code_naf: 'I', priorite: 2 },
        ],
      })
    })

    it("n'écrit que ce qui existe", () => {
      expect(importOne(makeProject({ priority: { default: 40 }, highlightPriority: null })).priorite).toEqual({ defaut: 40 })
      expect(importOne(makeProject({ highlightPriority: '8' })).priorite).toEqual({ mise_en_avant: 8 })
    })

    it('signale et ignore une mise en avant non numérique', () => {
      const input = importOne(makeProject({ highlightPriority: 'haute' }))
      expect(input).not.toHaveProperty('priorite')
      expect(importer.warnings).toEqual(['projet-test : priorité de mise en avant non numérique « haute », ignorée'])
    })
  })

  it('dérive les identifiants des dispositifs de leur slug, dans l’ordre amont', () => {
    const input = importOne(makeProject({ programs: ['visite-energie', 'baisse-les-watts'] }))
    expect(input.dispositifs).toEqual([SlugCanonicalId.from('visite-energie'), SlugCanonicalId.from('baisse-les-watts')])
  })

  describe('projets liés', () => {
    const parent = makeProject({ id: 31, slug: 'diag-360' })

    it('traduit les id numériques amont en identifiants pivot de projet', () => {
      const child = makeProject({
        id: 4,
        slug: 'plan-action',
        linkedProjects: [31],
        titleLinkedProjects: 'Les prérequis',
        descriptionLinkedProjects: 'À faire avant.',
      })
      // The linked project comes later in the file: the id table is built first.
      const [input] = importer.importMany([child, parent], NOW)

      expect(input.projets_lies).toEqual({
        titre: 'Les prérequis',
        description: 'À faire avant.',
        projets: [SlugCanonicalId.forProject('diag-360')],
      })
      expect(input.projets_lies?.projets).not.toContain(SlugCanonicalId.from('diag-360'))
    })

    it('ignore et signale un id amont inconnu', () => {
      const child = makeProject({ id: 4, slug: 'plan-action', linkedProjects: [31, 999] })
      const [input] = importer.importMany([child, parent], NOW)

      expect(input.projets_lies).toEqual({ projets: [SlugCanonicalId.forProject('diag-360')] })
      expect(importer.warnings).toEqual(['plan-action : projet lié inconnu (id amont 999), ignoré'])
    })

    it('garde un titre ou une description sans projet, omet un bloc vide', () => {
      expect(importOne(makeProject({ titleLinkedProjects: 'À venir' })).projets_lies).toEqual({
        titre: 'À venir',
        projets: [],
      })
      expect(importOne(makeProject({ descriptionLinkedProjects: 'Seule' })).projets_lies).toEqual({
        description: 'Seule',
        projets: [],
      })
      expect(importOne(makeProject({}))).not.toHaveProperty('projets_lies')
    })
  })

  describe('FAQ', () => {
    it("porte le titre et les questions, sans l'id amont", () => {
      const input = importOne(
        makeProject({ titleFaq: 'Questions fréquentes', faqs: [{ id: 146, question: 'Pourquoi ?', answer: 'Parce que **oui**.' }] }),
      )
      expect(input.faq).toEqual({
        titre: 'Questions fréquentes',
        questions: [{ question: 'Pourquoi ?', reponse: 'Parce que **oui**.' }],
      })
    })

    it('ignore et signale une question sans texte ou sans réponse', () => {
      const input = importOne(
        makeProject({
          faqs: [
            { question: 'Pourquoi ?', answer: '  ' },
            { question: '', answer: 'Réponse orpheline' },
            { question: 'Comment ?', answer: 'Ainsi.' },
          ],
        }),
      )
      expect(input.faq).toEqual({ questions: [{ question: 'Comment ?', reponse: 'Ainsi.' }] })
      expect(importer.warnings).toEqual(['projet-test : 2 question(s) de FAQ sans texte ou sans réponse, ignorée(s)'])
      expect(validator.validate(input).success).toBe(true)
    })
  })

  it('porte le SEO renseigné', () => {
    expect(importOne(makeProject({ metaTitle: 'Titre SEO' })).seo).toEqual({ titre: 'Titre SEO' })
    expect(importOne(makeProject({ metaTitle: 'Titre SEO', metaDescription: 'Description SEO' })).seo).toEqual({
      titre: 'Titre SEO',
      description: 'Description SEO',
    })
  })

  it('repart d’une liste d’avertissements vide à chaque exécution', () => {
    importOne(makeProject({ mainTheme: 'climat' }))
    expect(importer.warnings).toHaveLength(1)
    importOne(makeProject())
    expect(importer.warnings).toEqual([])
  })

  it('utilise par défaut la base des fichiers amont de UpstreamAssetSource', () => {
    const [input] = new TeeProjectImporter().importMany([makeProject({ image: '/images/projet/test.webp' })], NOW)
    expect(input.image?.url).toMatch(/^https:\/\/.+\/images\/projet\/test\.webp$/)
  })

  describe('extrait figé (static/input/projects-tests.json)', () => {
    const inputs = importer.importMany(teeProjectsSchema.parse(projectsFixture), NOW)

    it('produit 5 projets valides, sans avertissement', () => {
      expect(inputs).toHaveLength(5)
      expect(inputs.filter((input) => !validator.validate(input).success)).toEqual([])
      expect(importer.warnings).toEqual([])
    })

    it('ne référence que des projets liés présents dans l’extrait', () => {
      const ids = new Set(inputs.map((input) => input.id))
      const linked = inputs.flatMap((input) => input.projets_lies?.projets ?? [])
      expect(linked.length).toBeGreaterThan(0)
      expect(linked.every((id) => ids.has(id))).toBe(true)
    })

    it('porte FAQ et priorités par secteur du plan d’action économies d’énergie', () => {
      const plan = inputs.find((input) => input.slug === 'plan-action-eco-energie')
      expect(plan?.faq?.questions).toHaveLength(5)
      expect(plan?.priorite).toEqual({
        defaut: 40,
        mise_en_avant: 5,
        par_secteur: [
          { code_naf: '55', priorite: 2 },
          { code_naf: '56', priorite: 2 },
          { code_naf: 'C', priorite: 2 },
          { code_naf: 'I', priorite: 2 },
        ],
      })
    })
  })

  describe('copie versionnée complète (static/upstream/projects.json)', () => {
    const records = teeProjectsSchema.parse(new LocalJsonSnapshot().read<unknown>('projects'))
    const full = new TeeProjectImporter({ assetsBaseUrl: ASSETS })
    const inputs = full.importMany(records, NOW)

    it('importe les 91 projets, tous valides pour CanonicalProjectValidator', () => {
      expect(inputs).toHaveLength(91)
      const rejected = inputs
        .map((input) => ({ slug: input.slug, result: validator.validate(input) }))
        .filter(({ result }) => !result.success)
      expect(rejected).toEqual([])
      expect(full.warnings).toEqual([])
    })

    it('donne à chaque projet un identifiant et un slug uniques', () => {
      expect(new Set(inputs.map((input) => input.id)).size).toBe(91)
      expect(new Set(inputs.map((input) => input.slug)).size).toBe(91)
    })

    it('ne produit aucun bloc optionnel vide', () => {
      for (const input of inputs) {
        if (input.priorite) expect(Object.keys(input.priorite).length).toBeGreaterThan(0)
        if (input.seo) expect(Object.keys(input.seo).length).toBeGreaterThan(0)
        if (input.projets_lies) expect(input.projets_lies.projets.length + (input.projets_lies.titre ? 1 : 0)).toBeGreaterThan(0)
        if (input.description_complementaire) expect(input.description_complementaire.contenu.trim()).not.toBe('')
      }
    })
  })
})
