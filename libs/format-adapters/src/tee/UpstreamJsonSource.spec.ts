import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ExportLogger } from '../shared/ExportLogger'
import { LocalJsonSnapshot } from './LocalJsonSnapshot'
import { UpstreamJsonSource } from './UpstreamJsonSource'

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
const unreachable: typeof fetch = () => Promise.reject(new TypeError('fetch failed'))

class RecordingLogger implements ExportLogger {
  readonly warnings: string[] = []
  warn(message: string): void {
    this.warnings.push(message)
  }
}

function snapshotWith(files: Partial<Record<'programs' | 'projects' | 'redirects', unknown>>) {
  const snapshot = new LocalJsonSnapshot(mkdtempSync(join(tmpdir(), 'upstream-')))
  for (const [file, data] of Object.entries(files)) {
    snapshot.write(file as 'programs' | 'projects' | 'redirects', data)
  }
  return snapshot
}

describe('UpstreamJsonSource', () => {
  it('lit chaque fichier à son URL amont', async () => {
    const requested: string[] = []
    const fetchImpl: typeof fetch = (input) => {
      requested.push(String(input))
      return ok([{ id: 'a' }])
    }
    const source = new UpstreamJsonSource({
      urls: { programs: 'https://amont/programs.json', projects: 'https://amont/projects.json' },
      fetchImpl,
    })

    expect(await source.programs()).toEqual([{ id: 'a' }])
    expect(await source.projects()).toEqual([{ id: 'a' }])
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
    const fallback = snapshotWith({ projects: [{ id: 'local' }] })
    const source = new UpstreamJsonSource({
      fetchImpl: () => Promise.resolve(new Response('', { status: 503 })),
      fallback,
      logger: new RecordingLogger(),
    })

    expect(await source.projects()).toEqual([{ id: 'local' }])
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

  describe('forEnvironment', () => {
    it("n'a pas de copie locale en production", () => {
      const source = UpstreamJsonSource.forEnvironment(true)
      expect(source.describe()).not.toContain('copie locale')
    })

    it('active la copie locale hors production', () => {
      const source = UpstreamJsonSource.forEnvironment(false)
      expect(source.describe()).toContain(LocalJsonSnapshot.defaultDirectory())
    })
  })
})
