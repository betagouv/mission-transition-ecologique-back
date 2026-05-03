import type { Payload } from 'payload'
import type { GeographicAreaFixture } from './fixtures'
import { DEPARTEMENTS, REGIONS } from './fixtures'

export class GeographicAreasSeed {
  constructor(private readonly payload: Payload) {}

  async run(): Promise<void> {
    process.stdout.write(
      `Seeding ${REGIONS.length.toString()} regions + ${DEPARTEMENTS.length.toString()} departments...\n`,
    )

    const regionIdByInsee = new Map<string, number>()
    for (const region of REGIONS) {
      const id = await this.upsert(region, undefined)
      regionIdByInsee.set(region.inseeCode, id)
    }

    for (const dept of DEPARTEMENTS) {
      const parentId = dept.parentInseeCode
        ? regionIdByInsee.get(dept.parentInseeCode)
        : undefined
      await this.upsert(dept, parentId)
    }

    process.stdout.write('Geographic areas ready.\n')
  }

  private async upsert(
    fixture: GeographicAreaFixture,
    parentId: number | undefined,
  ): Promise<number> {
    const existing = await this.payload.find({
      collection: 'geographic-areas',
      where: {
        and: [
          { inseeCode: { equals: fixture.inseeCode } },
          { coverageType: { equals: fixture.coverageType } },
        ],
      },
      limit: 1,
    })

    const data = {
      name: fixture.name,
      coverageType: fixture.coverageType,
      inseeCode: fixture.inseeCode,
      ...(parentId !== undefined && { parentArea: parentId }),
    }

    if (existing.docs.length > 0) {
      const id = existing.docs[0].id as number
      await this.payload.update({ collection: 'geographic-areas', id, data })
      return id
    }
    const created = await this.payload.create({ collection: 'geographic-areas', data })
    return created.id as number
  }
}
