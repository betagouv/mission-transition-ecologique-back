// @vitest-environment node
import type { Payload } from 'payload'
import { Forbidden, getPayload } from 'payload'
import config from '@payload-config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { User } from '../../payload-types'

const GROUP = { name: 'Fixture groupe accès', slug: 'fixture-groupe-acces' }

let payload: Payload

describe('Operator groups access', () => {
  let creator: User
  let admin: User
  let groupId: number

  const asUser = (user: User) => ({ overrideAccess: false, user })

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const createUser = (role: User['role'], email: string) =>
      payload.create({ collection: 'users', data: { email, password: email, role } })
    creator = await createUser('creator', 'groups-creator@tee.test')
    admin = await createUser('admin', 'groups-admin@tee.test')
  })

  afterAll(async () => {
    await payload.delete({ collection: 'operator-groups', where: { slug: { like: 'fixture-groupe-acces' } } })
    await payload.delete({ collection: 'users', where: { email: { like: 'groups-' } } })
  })

  it('lets an admin create and update a group', async () => {
    groupId = (await payload.create({ collection: 'operator-groups', data: GROUP, ...asUser(admin) })).id
    const updated = await payload.update({
      collection: 'operator-groups',
      id: groupId,
      data: { name: 'Fixture groupe accès modifié' },
      ...asUser(admin),
    })
    expect(updated.name).toBe('Fixture groupe accès modifié')
  })

  it('forbids a creator to create or update a group', async () => {
    await expect(
      payload.create({ collection: 'operator-groups', data: { name: 'Interdit', slug: 'interdit' }, ...asUser(creator) }),
    ).rejects.toBeInstanceOf(Forbidden)
    await expect(
      payload.update({ collection: 'operator-groups', id: groupId, data: { name: 'Interdit' }, ...asUser(creator) }),
    ).rejects.toBeInstanceOf(Forbidden)
  })

  it('lets an admin delete a group, not a creator', async () => {
    await expect(payload.delete({ collection: 'operator-groups', id: groupId, ...asUser(creator) })).rejects.toBeInstanceOf(
      Forbidden,
    )
    await payload.delete({ collection: 'operator-groups', id: groupId, ...asUser(admin) })
    expect(await payload.count({ collection: 'operator-groups', where: { id: { equals: groupId } } })).toEqual({
      totalDocs: 0,
    })
  })
})
