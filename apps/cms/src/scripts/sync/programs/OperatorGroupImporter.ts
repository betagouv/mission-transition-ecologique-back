import type { Payload } from 'payload'
import type { TeeOperator } from '@tee-backoffice/format-adapters'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import { Slugify } from '@/utils/Slugify'
import type { UpstreamMediaImporter } from '../media/UpstreamMediaImporter'
import { OperatorGroupLogoDefaults } from './OperatorGroupLogoDefaults'

/** Upserts the operator groups named by upstream `operators.json` and returns name → id. */
export class OperatorGroupImporter {
  constructor(
    private readonly payload: Payload,
    private readonly media: UpstreamMediaImporter,
  ) {}

  async import(operators: TeeOperator[]): Promise<Map<string, number>> {
    const names = [...new Set(operators.flatMap((operator) => operator.filterCategories))]
    process.stdout.write(`Found ${names.length.toString()} operator groups. Upserting...\n`)

    // Matched by name too: a group created in the admin may carry a slug of its
    // own, and creating it again would break the unique name.
    const existing = await this.payload.find({
      collection: 'operator-groups',
      where: { or: [{ slug: { in: names.map((name) => Slugify.slugify(name)) } }, { name: { in: names } }] },
      limit: 0,
      depth: 0,
    })
    const existingBySlug = new Map(existing.docs.map((doc) => [doc.slug, doc]))
    const existingByName = new Map(existing.docs.map((doc) => [doc.name, doc]))

    const context = SystemWorkflowContext.create()
    const idByName = new Map<string, number>()
    for (const name of names) {
      const slug = Slugify.slugify(name)
      const current = existingBySlug.get(slug) ?? existingByName.get(name)
      let id: number
      if (current) {
        id = current.id
        if (current.name !== name) {
          await this.payload.update({ collection: 'operator-groups', id, data: { name }, context })
        }
      } else {
        id = (await this.payload.create({ collection: 'operator-groups', data: { name, slug }, context })).id
      }
      idByName.set(name, id)

      // A logo set in the admin wins over the generic upstream one.
      const defaultPath = OperatorGroupLogoDefaults.pathFor(name)
      if (defaultPath !== undefined && !current?.logo) {
        const logo = await this.media.findOrCreate(defaultPath, `Logo de ${name}`, 'operator-logo')
        if (logo !== undefined) {
          await this.payload.update({ collection: 'operator-groups', id, data: { logo }, context })
        }
      }
    }
    return idByName
  }
}
