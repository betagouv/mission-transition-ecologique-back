// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { UpstreamAssetSource } from '@tee-backoffice/format-adapters'
import { UpstreamMediaImporter } from '@/scripts/sync/media/UpstreamMediaImporter'
import { FakeAssetFetch } from '../support/FakeAssetFetch'

const IMAGE_PATH = '/images/projet/fixture-media-importer.webp'
const MISSING_PATH = '/images/projet/fixture-media-missing.webp'
const RECATEGORIZED_PATH = '/images/logos/operateur/fixture-media-recategorized.webp'

let payload: Payload

describe('UpstreamMediaImporter', () => {
  const assets = new FakeAssetFetch([IMAGE_PATH, RECATEGORIZED_PATH])
  let importer: UpstreamMediaImporter

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    importer = new UpstreamMediaImporter(
      payload,
      new UpstreamAssetSource({ baseUrl: FakeAssetFetch.BASE_URL, fetchImpl: assets.fetch }),
    )
  })

  afterAll(async () => {
    // Deleting the media also removes their files from the local upload folder.
    await payload.delete({ collection: 'media', where: { sourcePath: { contains: 'fixture-media' } } })
  })

  it('downloads and creates a media identified by its upstream path', async () => {
    const id = await importer.findOrCreate(IMAGE_PATH, 'Image de test', 'project-image')

    expect(id).toBeDefined()
    const media = await payload.findByID({ collection: 'media', id: id ?? 0 })
    expect(media).toMatchObject({
      alt: 'Image de test',
      category: 'project-image',
      sourcePath: IMAGE_PATH,
      mimeType: 'image/webp',
    })
    // Served by Payload from local disk: the tests never write to a real bucket.
    expect(media.url).toMatch(/^\/api\/media\/file\//)
    expect(importer.stats).toEqual({ created: 1, reused: 0, recategorized: 0, failed: 0 })
  })

  it('reuses the existing media without downloading it again', async () => {
    const before = await payload.count({ collection: 'media' })

    const first = await importer.findOrCreate(IMAGE_PATH, 'Image de test', 'project-image')
    const second = await new UpstreamMediaImporter(payload, { fetch: () => Promise.reject(new Error('unexpected download')) })
      .findOrCreate(IMAGE_PATH, 'Image de test', 'project-image')

    expect(second).toBe(first)
    expect((await payload.count({ collection: 'media' })).totalDocs).toBe(before.totalDocs)
    expect(assets.requested).toHaveLength(1)
    expect(importer.stats.reused).toBe(1)
    expect(importer.stats.recategorized).toBe(0)
  })

  it('realigns the category of an existing media on a later run', async () => {
    const id = await importer.findOrCreate(RECATEGORIZED_PATH, 'Logo de test', 'operator-logo')
    await payload.update({ collection: 'media', id: id ?? 0, data: { category: 'project-image' } })
    const rerun = new UpstreamMediaImporter(payload, { fetch: () => Promise.reject(new Error('unexpected download')) })

    expect(await rerun.findOrCreate(RECATEGORIZED_PATH, 'Logo de test', 'operator-logo')).toBe(id)

    expect((await payload.findByID({ collection: 'media', id: id ?? 0 })).category).toBe('operator-logo')
    expect(rerun.stats).toEqual({ created: 0, reused: 1, recategorized: 1, failed: 0 })
  })

  it('reports a missing file as a warning instead of failing', async () => {
    const id = await importer.findOrCreate(MISSING_PATH, 'Image absente', 'project-image')

    expect(id).toBeUndefined()
    expect([...importer.warnings.keys()]).toEqual([expect.stringContaining(MISSING_PATH)])
    expect([...importer.warnings.keys()][0]).toContain('404')
    expect(importer.stats.failed).toBe(1)
  })

  it('reports an unsafe upstream path without downloading it', async () => {
    const requests = assets.requested.length

    expect(await importer.findOrCreate('/images/../secret.webp', 'Chemin invalide', 'project-image')).toBeUndefined()
    expect(assets.requested).toHaveLength(requests)
    expect(importer.stats.failed).toBe(2)
  })
})
