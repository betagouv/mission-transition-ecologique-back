import type { Payload } from 'payload'
import type { SourceProgram } from './types'
import { Slugify } from '@/utils/Slugify'

export class OperatorImporter {
  constructor(private readonly payload: Payload) {}

  async import(programs: SourceProgram[]): Promise<Map<string, number>> {
    const slugToName = this.buildSlugToNameMap(programs)
    process.stdout.write(`Found ${slugToName.size.toString()} unique operators. Upserting...\n`)

    const idByName = await this.fetchExisting(slugToName)
    await this.createMissing(slugToName, idByName)

    return idByName
  }

  private buildSlugToNameMap(programs: SourceProgram[]): Map<string, string> {
    const slugToName = new Map<string, string>()
    for (const program of programs) {
      const allNames = [
        program['opérateur de contact'],
        ...(program['autres opérateurs'] ?? []),
      ].filter(Boolean)
      for (const name of allNames) {
        slugToName.set(Slugify.slugify(name), name)
      }
    }
    return slugToName
  }

  private async fetchExisting(slugToName: Map<string, string>): Promise<Map<string, number>> {
    const result = await this.payload.find({
      collection: 'operators',
      where: { slug: { in: [...slugToName.keys()] } },
      limit: slugToName.size,
    })

    const idByName = new Map<string, number>()
    for (const doc of result.docs) {
      const name = slugToName.get(doc.slug)
      if (name !== undefined) idByName.set(name, doc.id)
    }
    return idByName
  }

  private async createMissing(
    slugToName: Map<string, string>,
    idByName: Map<string, number>,
  ): Promise<void> {
    const missing = [...slugToName.entries()].filter(([, name]) => !idByName.has(name))

    await Promise.all(
      missing.map(async ([slug, name]) => {
        const created = await this.payload.create({ collection: 'operators', data: { name, slug } })
        idByName.set(name, created.id)
      }),
    )
  }
}
