import type { FetchLike } from './GristClient'
import { GristConfig } from './GristConfig'
import { GRIST_COLUMNS } from './gristColumns'
import { GristTableManager } from './GristTableManager'

const DESIRED = GRIST_COLUMNS.map((c) => c.colId)

const config = (): GristConfig => {
  const c = GristConfig.fromEnv({ GRIST_DOC_ID: 'doc', GRIST_TABLE_ID: 'Dispositifs', GRIST_API_KEY: 'k' })
  if (!c) throw new Error('config de test invalide')
  return c
}

/** In-memory Grist double: tracks tables and the target table's columns. */
class FakeGrist {
  readonly calls: string[] = []
  constructor(
    private tables: string[],
    private columns: string[],
  ) {}

  readonly fetch: FetchLike = (url, init) => {
    const method = init.method ?? 'GET'
    const path = url.replace('https://grist.numerique.gouv.fr/api/docs/doc', '')
    this.calls.push(`${method} ${path}`)
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(this.route(method, path, init))) })
  }

  private route(method: string, path: string, init: RequestInit): unknown {
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, { id: string; fields?: unknown }[]>) : {}
    if (method === 'GET' && path === '/tables') return { tables: this.tables.map((id) => ({ id })) }
    if (method === 'POST' && path === '/tables') {
      this.tables.push('Dispositifs')
      this.columns = (body['tables'] ?? [])
        .flatMap((t) => (t as unknown as { columns: { id: string }[] }).columns)
        .map((c) => c.id)
      return { tables: [{ id: 'Dispositifs' }] }
    }
    if (method === 'GET' && path === '/tables/Dispositifs/columns') return { columns: this.columns.map((id) => ({ id })) }
    if (method === 'POST' && path === '/tables/Dispositifs/columns') {
      this.columns.push(...(body['columns'] ?? []).map((c) => c.id))
      return {}
    }
    if (method === 'DELETE' && path.startsWith('/tables/Dispositifs/columns/')) {
      const colId = decodeURIComponent(path.split('/').pop() ?? '')
      this.columns = this.columns.filter((id) => id !== colId)
      return {}
    }
    return {}
  }

  columnIds(): string[] {
    return this.columns
  }
}

describe('GristTableManager', () => {
  it('crée la table absente avec toutes les colonnes du schéma', async () => {
    const grist = new FakeGrist([], [])
    const result = await new GristTableManager(config(), grist.fetch).prepareTable()

    expect(result.created).toBe(true)
    expect(grist.calls).toContain('POST /tables')
    expect(grist.columnIds()).toEqual(DESIRED)
    expect(result.added).toEqual([])
  })

  it('complète les colonnes manquantes d\'une table existante', async () => {
    const grist = new FakeGrist(['Dispositifs'], ['A', 'B', 'C'])
    const result = await new GristTableManager(config(), grist.fetch).prepareTable()

    expect(result.created).toBe(false)
    expect(result.added).toEqual(DESIRED)
    expect(result.removed).toEqual([])
    expect(grist.columnIds()).toEqual(['A', 'B', 'C', ...DESIRED])
  })

  it('supprime les colonnes hors schéma avec --prune', async () => {
    const grist = new FakeGrist(['Dispositifs'], ['A', 'B', 'C'])
    const result = await new GristTableManager(config(), grist.fetch).prepareTable({ pruneExtraColumns: true })

    expect(result.removed).toEqual(['A', 'B', 'C'])
    expect(grist.columnIds()).toEqual(DESIRED)
  })

  it('est idempotent quand la table est déjà alignée', async () => {
    const grist = new FakeGrist(['Dispositifs'], [...DESIRED])
    const result = await new GristTableManager(config(), grist.fetch).prepareTable({ pruneExtraColumns: true })

    expect(result).toEqual({ tableId: 'Dispositifs', created: false, added: [], removed: [] })
    expect(grist.calls).not.toContain('POST /tables')
  })
})
