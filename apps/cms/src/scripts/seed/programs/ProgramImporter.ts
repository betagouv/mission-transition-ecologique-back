import type { Payload } from 'payload'
import type { CanonicalProgramInput } from '@tee-backoffice/canonical'
import type { CanonicalToPayloadMapper } from '@/services/canonical/to-payload/CanonicalToPayloadMapper'
import { ProgressBar } from '@/utils/ProgressBar'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

export interface ImportResult {
  created: number
  updated: number
  errors: number
  /** Occurrences of each data-loss warning raised by the mapper. */
  warnings: Map<string, number>
}

export class ProgramImporter {
  constructor(
    private readonly payload: Payload,
    private readonly mapper: CanonicalToPayloadMapper,
  ) {}

  async import(programs: CanonicalProgramInput[]): Promise<ImportResult> {
    const existingIdBySlug = await this.fetchExisting(programs.map((p) => p.slug))

    const progress = new ProgressBar(programs.length)
    const result: ImportResult = { created: 0, updated: 0, errors: 0, warnings: new Map() }

    await Promise.all(programs.map(async (program) => {
      try {
        const { data, warnings } = this.mapper.map(program)
        for (const warning of warnings) result.warnings.set(warning, (result.warnings.get(warning) ?? 0) + 1)

        // The source status wins over the editorial workflow (e.g. re-publishing
        // an archived program), so the import writes as the system.
        const context = SystemWorkflowContext.create()
        const existingId = existingIdBySlug.get(program.slug)
        if (existingId !== undefined) {
          await this.payload.update({ collection: 'programs', id: existingId, data, draft: true, context })
          result.updated++
        } else {
          await this.payload.create({ collection: 'programs', data, draft: true, context })
          result.created++
        }
      } catch (err) {
        process.stderr.write(`Error importing program "${program.slug}": ${String(err)}\n`)
        result.errors++
      } finally {
        progress.tick()
      }
    }))

    progress.done()
    return result
  }

  private async fetchExisting(slugs: string[]): Promise<Map<string, number>> {
    const result = await this.payload.find({
      collection: 'programs',
      where: { slug: { in: slugs } },
      limit: slugs.length,
      depth: 0,
      draft: true,
    })
    return new Map(result.docs.map((doc) => [doc.slug, doc.id]))
  }
}
