// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { UpstreamAssetSource, type TeeProject } from '@tee-backoffice/format-adapters'
import { UpstreamMediaImporter } from '@/scripts/seed/media/UpstreamMediaImporter'
import { ProjectsSeed } from '@/scripts/seed/projects'
import { FakeAssetFetch } from '../support/FakeAssetFetch'

const IMAGE = '/images/projet/fixture-project-image.webp'
const IMAGE_V2 = '/images/projet/fixture-project-image-v2.webp'
const REMOVED = '/images/projet/fixture-project-removed.webp'
const THEN_404 = '/images/projet/fixture-project-404.webp'
const MISSING = '/images/projet/fixture-project-missing.webp'
const PIXEL = readFileSync(fileURLToPath(new URL('../fixtures/pixel.webp', import.meta.url)))

const project = (id: number, slug: string, image?: string): TeeProject => ({
  id,
  slug,
  title: `Titre ${slug}`,
  nameTag: slug,
  shortDescription: 'Description courte',
  longDescription: 'Description longue',
  mainTheme: 'energy',
  themes: ['energy'],
  image,
})
const UNUSABLE_PATH = 'fixture-image-chemin-inexploitable'
const SLUGS = [
  'fixture-image-changee',
  'fixture-image-retiree',
  'fixture-image-404',
  'fixture-image-manuelle',
  UNUSABLE_PATH,
]

let payload: Payload

describe('ProjectsSeed images', () => {
  const assets = new FakeAssetFetch([IMAGE, IMAGE_V2, REMOVED, THEN_404])
  let manualImage: number

  const seed = async (projects: TeeProject[], known = assets) => {
    const media = new UpstreamMediaImporter(
      payload,
      new UpstreamAssetSource({ baseUrl: FakeAssetFetch.BASE_URL, fetchImpl: known.fetch }),
    )
    const result = await new ProjectsSeed(payload, projects, media).run()
    return { result, media: media.stats }
  }
  const imageOf = async (slug: string) => {
    const result = await payload.find({ collection: 'projects', where: { slug: { equals: slug } }, depth: 1, limit: 1 })
    return result.docs[0]?.image
  }

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    // Uploaded by hand in the admin: no `sourcePath`.
    manualImage = (
      await payload.create({
        collection: 'media',
        data: { alt: 'Image choisie à la main', category: 'project-image' },
        file: { data: PIXEL, mimetype: 'image/webp', name: 'fixture-project-manual.webp', size: PIXEL.length },
      })
    ).id

    await seed([
      project(9001, SLUGS[0], IMAGE),
      project(9002, SLUGS[1], REMOVED),
      project(9003, SLUGS[2], THEN_404),
      project(9004, SLUGS[3], IMAGE),
    ])
    const manual = await payload.find({ collection: 'projects', where: { slug: { equals: SLUGS[3] } }, limit: 1 })
    await payload.update({ collection: 'projects', id: manual.docs[0]?.id ?? 0, data: { image: manualImage } })

    // Second run: new path, image dropped upstream, new path answering 404, manual image.
    await seed(
      [project(9001, SLUGS[0], IMAGE_V2), project(9002, SLUGS[1]), project(9003, SLUGS[2], MISSING), project(9004, SLUGS[3], IMAGE_V2)],
      new FakeAssetFetch([IMAGE_V2]),
    )
  })

  afterAll(async () => {
    await payload.delete({ collection: 'projects', where: { slug: { in: SLUGS } } })
    await payload.delete({
      collection: 'media',
      where: { or: [{ sourcePath: { in: [IMAGE, IMAGE_V2, REMOVED, THEN_404] } }, { id: { equals: manualImage } }] },
    })
  })

  it('replaces an imported image when the upstream path changes', async () => {
    expect(await imageOf(SLUGS[0])).toMatchObject({ sourcePath: IMAGE_V2, category: 'project-image' })
  })

  it('removes an imported image dropped upstream', async () => {
    expect(await imageOf(SLUGS[1])).toBeFalsy()
  })

  it('keeps the current image when the new one fails to download', async () => {
    expect(await imageOf(SLUGS[2])).toMatchObject({ sourcePath: THEN_404 })
  })

  it('never overwrites an image uploaded by hand', async () => {
    expect(await imageOf(SLUGS[3])).toMatchObject({ id: manualImage })
  })

  it('keeps the current image when the upstream path cannot be used, counted as a failed import', async () => {
    await seed([project(9005, UNUSABLE_PATH, IMAGE)])
    expect(await imageOf(UNUSABLE_PATH)).toMatchObject({ sourcePath: IMAGE })

    // Not rooted: the reader cannot turn it into a URL.
    const { result, media } = await seed([project(9005, UNUSABLE_PATH, 'images/projet/x.webp')])

    expect(result).toMatchObject({ updated: 1, errors: 0 })
    expect(media.failed).toBe(1)
    expect(await imageOf(UNUSABLE_PATH)).toMatchObject({ sourcePath: IMAGE })
  })

  it('creates neither a project nor a media when the same source is seeded again', async () => {
    const { result, media } = await seed(
      [project(9001, SLUGS[0], IMAGE_V2), project(9002, SLUGS[1]), project(9004, SLUGS[3], IMAGE_V2)],
      new FakeAssetFetch([IMAGE_V2]),
    )

    expect(result).toMatchObject({ created: 0, updated: 3, errors: 0 })
    expect(media).toMatchObject({ created: 0, failed: 0 })
    expect(await imageOf(SLUGS[0])).toMatchObject({ sourcePath: IMAGE_V2 })
  })
})
