// @vitest-environment node
import type { Payload } from 'payload'
import { Forbidden, getPayload, ValidationError } from 'payload'
import config from '@payload-config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import type { User } from '../../payload-types'

const PIXEL = readFileSync(fileURLToPath(new URL('../fixtures/pixel.webp', import.meta.url)))
const pixelFile = (name: string) => ({ data: PIXEL, mimetype: 'image/webp', name, size: PIXEL.length })
const invalidPaths = async (write: Promise<unknown>): Promise<string[]> => {
  const error = await write.then(
    () => undefined,
    (err: unknown) => err,
  )
  expect(error).toBeInstanceOf(ValidationError)
  return (error as ValidationError).data.errors.map((fieldError) => fieldError.path)
}

let payload: Payload

describe('Media access, sourcePath lock and category filters', () => {
  let creator: User
  let admin: User
  let operatorLogo: number
  let projectImage: number
  const createdMedia: number[] = []

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    creator = await payload.create({
      collection: 'users',
      data: { email: 'media-creator@tee.test', password: 'media-creator@tee.test', role: 'creator' },
    })
    admin = await payload.create({
      collection: 'users',
      data: { email: 'media-admin@tee.test', password: 'media-admin@tee.test', role: 'admin' },
    })
    operatorLogo = (
      await payload.create({
        collection: 'media',
        data: { alt: 'Logo', category: 'operator-logo', sourcePath: '/images/logos/operateur/fixture-rules.webp' },
        file: pixelFile('fixture-rules-logo.webp'),
      })
    ).id
    projectImage = (
      await payload.create({
        collection: 'media',
        data: { alt: 'Image', category: 'project-image' },
        file: pixelFile('fixture-rules-project.webp'),
      })
    ).id
    createdMedia.push(operatorLogo, projectImage)
  })

  afterAll(async () => {
    await payload.delete({ collection: 'operators', where: { name: { like: 'Fixture règles média' } } })
    await payload.delete({ collection: 'media', where: { id: { in: createdMedia } } })
  })

  it('copies an imported media as a manual upload, without its source path', async () => {
    // Trusted server-side call: field access, which also strips the value, is bypassed.
    const copy = await payload.duplicate({ collection: 'media', id: operatorLogo })
    createdMedia.push(copy.id)

    expect(copy.sourcePath ?? null).toBeNull()
    expect(copy.filename).not.toBe('fixture-rules-logo.webp')
  })

  it('refuses a media upload to a non-admin user', async () => {
    await expect(
      payload.create({
        collection: 'media',
        data: { alt: 'Upload créateur', category: 'project-image' },
        file: pixelFile('fixture-rules-creator.webp'),
        user: creator,
        overrideAccess: false,
      }),
    ).rejects.toBeInstanceOf(Forbidden)
    await expect(
      payload.update({ collection: 'media', id: projectImage, data: { alt: 'Modifié' }, user: creator, overrideAccess: false }),
    ).rejects.toBeInstanceOf(Forbidden)
  })

  it('ignores a sourcePath sent through the API by an admin, on create and on update', async () => {
    const created = await payload.create({
      collection: 'media',
      data: { alt: 'Upload admin', category: 'project-image', sourcePath: '/images/projet/forged.webp' },
      file: pixelFile('fixture-rules-admin.webp'),
      user: admin,
      overrideAccess: false,
    })
    createdMedia.push(created.id)
    expect(created.sourcePath ?? null).toBeNull()

    await payload.update({
      collection: 'media',
      id: operatorLogo,
      data: { alt: 'Logo modifié', sourcePath: '/images/logos/operateur/forged.webp' },
      user: admin,
      overrideAccess: false,
    })
    const updated = await payload.findByID({ collection: 'media', id: operatorLogo })
    expect(updated).toMatchObject({ alt: 'Logo modifié', sourcePath: '/images/logos/operateur/fixture-rules.webp' })
  })

  it('rejects an operator logo that is not an operator-logo media, even without access control', async () => {
    expect(
      await invalidPaths(
        payload.create({ collection: 'operators', data: { name: 'Fixture règles média refusé', logo: projectImage } }),
      ),
    ).toEqual(['logo'])

    const accepted = await payload.create({
      collection: 'operators',
      data: { name: 'Fixture règles média accepté', logo: operatorLogo },
    })
    expect(accepted.logo).toMatchObject({ id: operatorLogo })
  })

  it('rejects a project-image media on an operator group logo', async () => {
    expect(
      await invalidPaths(
        payload.create({
          collection: 'operator-groups',
          data: { name: 'Fixture règles média', slug: 'fixture-regles-media', logo: projectImage },
        }),
      ),
    ).toEqual(['logo'])
  })
})
