import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ExportLogger } from '../shared/ExportLogger'
import { LocalJsonSnapshot } from './LocalJsonSnapshot'
import { UpstreamFallbackSettings } from './UpstreamFallbackSettings'
import type { UpstreamFile } from './UpstreamFile'
import { UpstreamJsonSource } from './UpstreamJsonSource'

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
const unreachable: typeof fetch = () => Promise.reject(new TypeError('fetch failed'))

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

class RecordingLogger implements ExportLogger {
  readonly warnings: string[] = []
  warn(message: string): void {
    this.warnings.push(message)
  }
}

function snapshotWith(files: Partial<Record<UpstreamFile, unknown>>) {
  const snapshot = new LocalJsonSnapshot(mkdtempSync(join(tmpdir(), 'upstream-')))
  for (const [file, data] of Object.entries(files)) {
    snapshot.write(file as UpstreamFile, data)
  }
  return snapshot
}

describe('UpstreamJsonSource', () => {
  it('lit chaque fichier à son URL amont', async () => {
    const requested: string[] = []
    const fetchImpl: typeof fetch = (input) => {
      requested.push(String(input))
      return String(input).endsWith('projects.json') ? ok([project]) : ok([{ id: 'a' }])
    }
    const source = new UpstreamJsonSource({
      urls: { programs: 'https://amont/programs.json', projects: 'https://amont/projects.json' },
      fetchImpl,
    })

    expect(await source.programs()).toEqual([{ id: 'a' }])
    expect(await source.projects()).toEqual([project])
    expect(requested).toEqual(['https://amont/programs.json', 'https://amont/projects.json'])
  })

  it('bascule sur la copie locale si GitHub est injoignable, en le signalant', async () => {
    const logger = new RecordingLogger()
    const fallback = snapshotWith({ programs: [{ id: 'local' }] })
    const source = new UpstreamJsonSource({ fetchImpl: unreachable, fallback, logger })

    expect(await source.programs()).toEqual([{ id: 'local' }])
    expect(logger.warnings).toHaveLength(1)
    expect(logger.warnings[0]).toContain('copie locale utilisée')
  })

  it('bascule aussi sur une réponse HTTP en erreur', async () => {
    const fallback = snapshotWith({ projects: [project] })
    const source = new UpstreamJsonSource({
      fetchImpl: () => Promise.resolve(new Response('', { status: 503 })),
      fallback,
      logger: new RecordingLogger(),
    })

    expect(await source.projects()).toEqual([project])
  })

  it('échoue sans copie locale configurée', async () => {
    const source = new UpstreamJsonSource({ fetchImpl: unreachable })
    await expect(source.programs()).rejects.toThrow('fetch failed')
  })

  it('échoue si la copie locale ne contient pas le fichier', async () => {
    const source = new UpstreamJsonSource({ fetchImpl: unreachable, fallback: snapshotWith({}) })
    await expect(source.programs()).rejects.toThrow('fetch failed')
  })

  describe('redirections', () => {
    const answering = (status: number): typeof fetch => () => Promise.resolve(new Response('', { status }))

    it('renvoie null quand le fichier est absent en amont (404)', async () => {
      const source = new UpstreamJsonSource({ fetchImpl: answering(404) })
      expect(await source.redirects()).toBeNull()
    })

    it('propage une erreur serveur au lieu de la prendre pour un fichier absent', async () => {
      const source = new UpstreamJsonSource({ fetchImpl: answering(503) })
      await expect(source.redirects()).rejects.toMatchObject({ name: 'UpstreamFetchError', status: 503 })
    })

    it('propage une panne réseau', async () => {
      const source = new UpstreamJsonSource({ fetchImpl: unreachable })
      await expect(source.redirects()).rejects.toThrow('fetch failed')
    })

    it('propage un JSON illisible', async () => {
      const source = new UpstreamJsonSource({
        fetchImpl: () => Promise.resolve(new Response('{tronqué', { status: 200 })),
      })
      await expect(source.redirects()).rejects.toThrow(SyntaxError)
    })

    it('renvoie null sur un 404 même avec une copie locale sans redirections', async () => {
      const source = new UpstreamJsonSource({
        fetchImpl: answering(404),
        fallback: snapshotWith({}),
        logger: new RecordingLogger(),
      })
      expect(await source.redirects()).toBeNull()
    })
  })

  describe('opérateurs', () => {
    const ademe = {
      operator: 'ADEME',
      filterCategories: ['ADEME'],
      imagePath: '/images/logos/operateur/ademe.webp',
      color: 'purple',
    }
    const answering = (status: number, body = ''): typeof fetch => () => Promise.resolve(new Response(body, { status }))

    it("lit operators.json à son URL propre, hors du dossier des autres fichiers", async () => {
      const requested: string[] = []
      const source = new UpstreamJsonSource({
        fetchImpl: (input) => {
          requested.push(String(input))
          return ok([ademe])
        },
      })

      expect(await source.operators()).toEqual([ademe])
      expect(requested).toEqual([
        'https://raw.githubusercontent.com/betagouv/mission-transition-ecologique/main/apps/nuxt/src/public/json/operator/operators.json',
      ])
      expect(source.describe()).toContain('operators.json')
    })

    it('complète les groupes absents par une liste vide', async () => {
      const source = new UpstreamJsonSource({ fetchImpl: () => ok([{ operator: 'CCI Bretagne' }]) })
      expect(await source.operators()).toEqual([{ operator: 'CCI Bretagne', filterCategories: [] }])
    })

    it('traite un logo ou des groupes vides ou null comme absents', async () => {
      const source = new UpstreamJsonSource({
        fetchImpl: () =>
          ok([
            { operator: 'CCI Bretagne', filterCategories: null, imagePath: '' },
            { operator: 'CMA Corse', filterCategories: ['CMA'], imagePath: null },
          ]),
      })
      expect(await source.operators()).toEqual([
        { operator: 'CCI Bretagne', filterCategories: [] },
        { operator: 'CMA Corse', filterCategories: ['CMA'] },
      ])
    })

    it('refuse une forme invalide', async () => {
      const source = new UpstreamJsonSource({ fetchImpl: () => ok([{ operator: '', filterCategories: 'OPCO' }]) })
      await expect(source.operators()).rejects.toMatchObject({ name: 'ZodError' })
    })

    it('propage un 404', async () => {
      const source = new UpstreamJsonSource({
        fetchImpl: answering(404),
        fallback: snapshotWith({ operators: [ademe] }),
        logger: new RecordingLogger(),
      })
      await expect(source.operators()).rejects.toMatchObject({ name: 'UpstreamFetchError', status: 404 })
    })

    it('propage un JSON illisible', async () => {
      const source = new UpstreamJsonSource({
        fetchImpl: answering(200, '{tronqué'),
        fallback: snapshotWith({ operators: [ademe] }),
        logger: new RecordingLogger(),
      })
      await expect(source.operators()).rejects.toThrow(SyntaxError)
    })

    it('bascule sur la copie locale sur une erreur serveur, en la validant', async () => {
      const logger = new RecordingLogger()
      const source = new UpstreamJsonSource({
        fetchImpl: answering(503),
        fallback: snapshotWith({ operators: [ademe] }),
        logger,
      })

      expect(await source.operators()).toEqual([ademe])
      expect(logger.warnings[0]).toContain('operators.json')
    })
  })

  describe('projets', () => {
    it('garde les clés inconnues et un highlightPriority null', async () => {
      const upstream = { ...project, highlightPriority: null, faqs: [{ id: 146, question: 'Q ?', answer: 'R.' }], futur: 1 }
      const source = new UpstreamJsonSource({ fetchImpl: () => ok([upstream]) })
      expect(await source.projects()).toEqual([upstream])
    })

    it('lit une cellule optionnelle vide ou null comme absente', async () => {
      const upstream = { ...project, image: null, programs: null, titleFaq: '', priority: null }
      const source = new UpstreamJsonSource({ fetchImpl: () => ok([upstream]) })

      const [read] = await source.projects()

      expect(read).toEqual(project)
      expect(source.rejectedProjects).toEqual([])
    })

    it('écarte et signale le seul enregistrement hors forme, les autres sont renvoyés', async () => {
      const logger = new RecordingLogger()
      const broken = { ...project, id: 32, slug: 'bilan-carbone', title: null }
      const source = new UpstreamJsonSource({ fetchImpl: () => ok([project, broken]), logger })

      expect(await source.projects()).toEqual([project])
      expect(source.rejectedProjects).toEqual([
        { index: 1, slug: 'bilan-carbone', reason: expect.stringContaining('title : ') },
      ])
      expect(logger.warnings).toHaveLength(1)
      expect(logger.warnings[0]).toContain('projects.json : enregistrement écarté (bilan-carbone : title : ')
    })

    it('ne garde que les enregistrements écartés de la dernière lecture', async () => {
      const responses = [[{ ...project, themes: 'environmental' }], [project]]
      const source = new UpstreamJsonSource({
        fetchImpl: () => ok(responses.shift()),
        logger: new RecordingLogger(),
      })

      expect(await source.projects()).toEqual([])
      expect(source.rejectedProjects).toHaveLength(1)
      expect(await source.projects()).toEqual([project])
      expect(source.rejectedProjects).toEqual([])
    })

    it("échoue si le fichier n'est pas un tableau", async () => {
      const source = new UpstreamJsonSource({ fetchImpl: () => ok({ projects: [project] }) })
      await expect(source.projects()).rejects.toThrow('un tableau de projets est attendu')
    })

    it('valide aussi la copie locale utilisée en secours', async () => {
      const logger = new RecordingLogger()
      const source = new UpstreamJsonSource({
        fetchImpl: unreachable,
        fallback: snapshotWith({ projects: [{ id: 'local' }, project] }),
        logger,
      })

      expect(await source.projects()).toEqual([project])
      expect(source.rejectedProjects).toMatchObject([{ index: 0 }])
      expect(source.rejectedProjects[0]).not.toHaveProperty('slug')
    })
  })

  describe('lecture brute', () => {
    it('renvoie le fichier tel que publié, sans validation ni réordonnancement des clés', async () => {
      const upstream = [{ faqs: [{ id: 146, question: 'Q ?', answer: 'R.' }], title: null, slug: 'diag-360' }]
      const source = new UpstreamJsonSource({ fetchImpl: () => ok(upstream) })

      expect(JSON.stringify(await source.raw('projects'))).toBe(JSON.stringify(upstream))
    })
  })

  describe('repli limité aux pannes', () => {
    it('ne bascule pas sur un 404 : le fichier a vraiment bougé en amont', async () => {
      const source = new UpstreamJsonSource({
        fetchImpl: () => Promise.resolve(new Response('', { status: 404 })),
        fallback: snapshotWith({ programs: [{ id: 'local' }] }),
        logger: new RecordingLogger(),
      })
      await expect(source.programs()).rejects.toMatchObject({ status: 404 })
    })

    it('ne bascule pas sur un JSON invalide', async () => {
      const source = new UpstreamJsonSource({
        fetchImpl: () => Promise.resolve(new Response('{tronqué', { status: 200 })),
        fallback: snapshotWith({ programs: [{ id: 'local' }] }),
        logger: new RecordingLogger(),
      })
      await expect(source.programs()).rejects.toThrow(SyntaxError)
    })
  })

  describe('fromSettings', () => {
    it("n'a pas de copie locale sans TEE_UPSTREAM_LOCAL_FALLBACK", () => {
      const source = UpstreamJsonSource.fromSettings(UpstreamFallbackSettings.fromEnv({}))
      expect(source.describe()).not.toContain('copie locale')
    })

    it('active la copie locale quand TEE_UPSTREAM_LOCAL_FALLBACK est posée', () => {
      const source = UpstreamJsonSource.fromSettings(UpstreamFallbackSettings.fromEnv({ TEE_UPSTREAM_LOCAL_FALLBACK: '1' }))
      expect(source.describe()).toContain(LocalJsonSnapshot.defaultDirectory())
    })
  })
})
