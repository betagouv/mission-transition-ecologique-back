import { ValidationError, type Payload } from 'payload'
import type { CanonicalProgramInput } from '@tee-backoffice/canonical'
import { CanonicalSyncPolicy } from '@/services/canonical/CanonicalSyncPolicy'
import type {
  CanonicalToPayloadMapper,
  PayloadProgramData,
} from '@/services/canonical/to-payload/CanonicalToPayloadMapper'
import { UpstreamFingerprint } from '@/services/upstream-sync/UpstreamFingerprint'
import { ProgressBar } from '@/utils/ProgressBar'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import { SyncErrorFormatter } from '../SyncErrorFormatter'

export interface ImportResult {
  created: number
  updated: number
  /** Programs left alone: they already hold what upstream provides. */
  unchanged: number
  errors: number
  /** Occurrences of each data-loss warning raised by the mapper. */
  warnings: Map<string, number>
}

interface ExistingProgram {
  id: number
  fingerprint: string | null | undefined
}

export class ProgramImporter {
  constructor(
    private readonly payload: Payload,
    private readonly mapper: CanonicalToPayloadMapper,
    // Canonical ids the store holds: a program missing from it is rewritten even
    // when unchanged, so a failed canonical sync heals on the next run. Without
    // it, the store is not looked at.
    private readonly storedCanonicalIds?: ReadonlySet<string>,
  ) {}

  async import(programs: CanonicalProgramInput[]): Promise<ImportResult> {
    const existingBySlug = await this.fetchExisting(programs.map((p) => p.slug))

    const progress = new ProgressBar(programs.length)
    const result: ImportResult = { created: 0, updated: 0, unchanged: 0, errors: 0, warnings: new Map() }

    await Promise.all(programs.map(async (program) => {
      try {
        const { data, warnings } = this.mapper.map(program)
        for (const warning of warnings) result.warnings.set(warning, (result.warnings.get(warning) ?? 0) + 1)

        const existing = existingBySlug.get(program.slug)
        const fingerprint = UpstreamFingerprint.of(data)
        if (existing?.fingerprint === fingerprint && this.isStored(data)) {
          result.unchanged++
          return
        }

        try {
          await this.write({ ...data, upstreamFingerprint: fingerprint }, existing?.id)
        } catch (err) {
          // Upstream is master: a program Payload refuses to publish stays in
          // creation, visible to editors, instead of being left out. Without a
          // fingerprint, so every run tries again and reports it.
          if (!(err instanceof ValidationError) || data._status !== 'published') throw err
          await this.write(
            { ...data, workflowStatus: 'en-creation', _status: 'draft', upstreamFingerprint: null },
            existing?.id,
          )
          const warning = `« ${program.slug} » : publication refusée par Payload (${SyncErrorFormatter.format(err)}), dispositif laissé en création`
          result.warnings.set(warning, (result.warnings.get(warning) ?? 0) + 1)
        }
        if (existing !== undefined) result.updated++
        else result.created++
      } catch (err) {
        process.stderr.write(`Error importing program "${program.slug}": ${SyncErrorFormatter.format(err)}\n`)
        result.errors++
      } finally {
        progress.tick()
      }
    }))

    progress.done()
    return result
  }

  /** Whether the canonical store holds the program, when its status sends it there. */
  private isStored(data: PayloadProgramData): boolean {
    if (!this.storedCanonicalIds) return true
    if (CanonicalSyncPolicy.actionFor(data.workflowStatus ?? 'en-creation') !== 'save') return true
    return Boolean(data.canonicalId) && this.storedCanonicalIds.has(data.canonicalId as string)
  }

  private async write(data: PayloadProgramData, existingId: number | undefined): Promise<void> {
    // The source status wins over the editorial workflow (e.g. re-publishing
    // an archived program), so the import writes as the system.
    const context = SystemWorkflowContext.create()
    // `draft: true` makes Payload skip field validation on create, and
    // `beforeChangeWorkflow` would then still publish the document: only a
    // program that is not published (in creation, replaced) is saved as a draft.
    const draft = data._status !== 'published'
    if (existingId !== undefined) {
      await this.payload.update({ collection: 'programs', id: existingId, data, draft, context })
    } else {
      await this.payload.create({ collection: 'programs', data, draft, context })
    }
  }

  /** Latest versions: the status and the fingerprint of a program saved as a draft only live there. */
  private async fetchExisting(slugs: string[]): Promise<Map<string, ExistingProgram>> {
    const result = await this.payload.find({
      collection: 'programs',
      where: { slug: { in: slugs } },
      limit: slugs.length,
      depth: 0,
      draft: true,
    })
    return new Map(result.docs.map((doc) => [doc.slug, { id: doc.id, fingerprint: doc.upstreamFingerprint }]))
  }
}
