import type { Payload } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

import type { UserFixture } from './types'

const FIXTURES: UserFixture[] = [
  {
    email: 'super.admin@tee.test',
    role: UserRole.SUPER_ADMIN,
  },
  {
    email: 'admin@tee.test',
    role: UserRole.ADMIN,
    team: 'ADEME Grand Est',
    region: 'Grand Est',
    operatorSlug: 'ademe',
  },
  {
    email: 'createur@tee.test',
    role: UserRole.CREATOR,
    team: 'CCI Grand Est',
    region: 'Grand Est',
    operatorSlug: 'ademe',
  },
]

export class UsersSeed {
  constructor(private readonly payload: Payload) {}

  async run(): Promise<void> {
    process.stdout.write(`Seeding ${FIXTURES.length.toString()} users fixtures...\n`)

    const operatorCache = new Map<string, number>()

    for (const fixture of FIXTURES) {
      const operatorId = fixture.operatorSlug
        ? await this.resolveOperator(fixture.operatorSlug, operatorCache)
        : undefined

      await this.upsert(fixture, operatorId)
    }

    process.stdout.write('User fixtures ready.\n')
  }

  private async upsert(fixture: UserFixture, operatorId: number | undefined): Promise<void> {
    const existing = await this.payload.find({
      collection: 'users',
      where: { email: { equals: fixture.email } },
      limit: 1,
    })

    const data = {
      email: fixture.email,
      password: fixture.email,
      role: fixture.role,
      ...(fixture.team !== undefined && { team: fixture.team }),
      ...(fixture.region !== undefined && { region: fixture.region }),
      ...(operatorId !== undefined && { operator: operatorId }),
    }

    if (existing.docs.length > 0) {
      await this.payload.update({ collection: 'users', id: existing.docs[0].id, data })
      process.stdout.write(`  updated ${fixture.email}\n`)
    } else {
      await this.payload.create({ collection: 'users', data })
      process.stdout.write(`  created ${fixture.email}\n`)
    }
  }

  private async resolveOperator(
    slug: string,
    cache: Map<string, number>,
  ): Promise<number | undefined> {
    if (cache.has(slug)) return cache.get(slug)

    const result = await this.payload.find({
      collection: 'operators',
      where: { slug: { equals: slug } },
      limit: 1,
    })

    if (result.docs.length === 0) {
      // Fallback: pick first operator available
      const fallback = await this.payload.find({ collection: 'operators', limit: 1 })
      const id = fallback.docs[0]?.id
      if (id !== undefined) cache.set(slug, id)
      return id
    }

    const id = result.docs[0].id
    cache.set(slug, id)
    return id
  }
}
