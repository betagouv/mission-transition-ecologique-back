import { GristClient } from './GristClient'
import type { FetchLike } from './GristClient'
import { GristConfig } from './GristConfig'
import type { GristRecord } from './grist.types'

const config = (): GristConfig => {
  const c = GristConfig.fromEnv({ GRIST_DOC_ID: 'doc', GRIST_TABLE_ID: 'tbl', GRIST_API_KEY: 'secret' })
  if (!c) throw new Error('config de test invalide')
  return c
}

const record = (slug: string): GristRecord => ({ slug, rnasp_id: `id-${slug}`, technical: '{}' } as unknown as GristRecord)

interface Captured {
  url: string
  init: RequestInit
}

const okFetch = (sink: Captured[]): FetchLike => (url, init) => {
  sink.push({ url, init })
  return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') })
}

describe('GristClient', () => {
  it('PUT upsert avec require={slug}, fields et auth Bearer', async () => {
    const captured: Captured[] = []
    await new GristClient(config(), okFetch(captured)).upsertMany([record('aide-a'), record('aide-b')])

    expect(captured).toHaveLength(1)
    const { url, init } = captured[0]!
    expect(url).toBe('https://grist.numerique.gouv.fr/api/docs/doc/tables/tbl/records')
    expect(init.method).toBe('PUT')
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer secret')

    const body = JSON.parse(String(init.body)) as { records: { require: { slug: string }; fields: GristRecord }[] }
    expect(body.records).toHaveLength(2)
    expect(body.records[0]?.require).toEqual({ slug: 'aide-a' })
    expect(body.records[0]?.fields.rnasp_id).toBe('id-aide-a')
  })

  it('n\'appelle pas le réseau pour une liste vide', async () => {
    const captured: Captured[] = []
    await new GristClient(config(), okFetch(captured)).upsertMany([])
    expect(captured).toHaveLength(0)
  })

  it('jette sur réponse non-ok', async () => {
    const failFetch: FetchLike = () => Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('unauthorized') })
    await expect(new GristClient(config(), failFetch).upsertMany([record('x')])).rejects.toThrow('401')
  })

  it('fractionne en plusieurs requêtes sous la limite de taille (évite le 413)', async () => {
    const captured: Captured[] = []
    // Budget minuscule → chaque enregistrement part dans sa propre requête.
    await new GristClient(config(), okFetch(captured), 10).upsertMany([record('a'), record('b'), record('c')])

    expect(captured).toHaveLength(3)
    const slugs = captured.flatMap(
      ({ init }) => (JSON.parse(String(init.body)) as { records: { require: { slug: string } }[] }).records.map((r) => r.require.slug),
    )
    expect(slugs).toEqual(['a', 'b', 'c'])
  })
})
