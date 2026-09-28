import type { Payload } from 'payload'
import type { TeeOperator } from '@tee-backoffice/format-adapters'
import type { Operator } from '../../../../payload-types'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import { Slugify } from '@/utils/Slugify'
import type { UpstreamMediaImporter } from '../media/UpstreamMediaImporter'

export interface OperatorProfileResult {
  updated: number
  /** Occurrences of each warning (upstream operator unknown to the CMS). */
  warnings: Map<string, number>
}

/**
 * Attaches the upstream groups and logo to each CMS operator, matched by the
 * slug of its name (same slug as `OperatorImporter`). Upstream operators the CMS
 * does not know are reported, not created: the CMS only holds operators that a
 * program cites.
 */
export class OperatorProfileImporter {
  constructor(
    private readonly payload: Payload,
    private readonly media: UpstreamMediaImporter,
  ) {}

  async import(operators: TeeOperator[], groupIdByName: Map<string, number>): Promise<OperatorProfileResult> {
    const result: OperatorProfileResult = { updated: 0, warnings: new Map() }
    const cmsOperatorBySlug = await this.fetchExisting(operators)
    const context = SystemWorkflowContext.create()

    // Sequential: media creation must not run concurrently (see UpstreamMediaImporter).
    for (const operator of operators) {
      const cmsOperator = cmsOperatorBySlug.get(Slugify.slugify(operator.operator))
      if (!cmsOperator) {
        const warning = `« ${operator.operator} » : opérateur amont sans correspondance dans le CMS`
        result.warnings.set(warning, (result.warnings.get(warning) ?? 0) + 1)
        continue
      }

      const groups = operator.filterCategories
        .map((name) => groupIdByName.get(name))
        .filter((id): id is number => id !== undefined)
      const data: { groups: number[]; logo?: number | null } = { groups }

      if (OperatorProfileImporter.logoIsImported(cmsOperator)) {
        if (!operator.imagePath) {
          data.logo = null
        } else {
          // A failed download keeps the current logo rather than clearing it.
          const logo = await this.media.findOrCreate(operator.imagePath, `Logo de ${operator.operator}`, 'operator-logo')
          if (logo !== undefined) data.logo = logo
        }
      }

      await this.payload.update({ collection: 'operators', id: cmsOperator.id, data, context })
      result.updated++
    }
    return result
  }

  // Upstream is master for the logos it provided (media with a `sourcePath`); a
  // logo uploaded by hand in the admin (no `sourcePath`) is never overwritten.
  private static logoIsImported(operator: Operator): boolean {
    const logo = operator.logo
    if (logo === null || logo === undefined) return true
    return typeof logo === 'object' && Boolean(logo.sourcePath)
  }

  private async fetchExisting(operators: TeeOperator[]): Promise<Map<string, Operator>> {
    const slugs = operators.map((operator) => Slugify.slugify(operator.operator))
    const result = await this.payload.find({
      collection: 'operators',
      where: { slug: { in: slugs } },
      limit: slugs.length,
      depth: 1,
    })
    return new Map(
      result.docs.flatMap((doc) => (doc.slug ? [[doc.slug, doc] as const] : [])),
    )
  }
}
