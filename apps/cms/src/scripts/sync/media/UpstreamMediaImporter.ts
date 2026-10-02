import type { Payload } from 'payload'
import { UpstreamFetchError, type UpstreamAssetSource } from '@tee-backoffice/format-adapters'
import type { MediaCategory } from '@/constants/mediaCategoryOptions'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import { SyncErrorFormatter } from '../SyncErrorFormatter'

export type UpstreamAssetFetcher = Pick<UpstreamAssetSource, 'fetch'>

export interface MediaImportStats {
  created: number
  reused: number
  /** Reused media whose category had to be realigned. */
  recategorized: number
  failed: number
}

/**
 * Turns an upstream file path into a `media` id, downloading the file only when
 * no media carries that `sourcePath` yet. Payload may rename a file on a name
 * clash, so the upstream path, not the filename, identifies an imported media.
 * Callers must use it sequentially: concurrent calls could create the same path twice.
 */
export class UpstreamMediaImporter {
  readonly stats: MediaImportStats = { created: 0, reused: 0, recategorized: 0, failed: 0 }
  /** Occurrences of each missing-file warning, reported at the end of the seed. */
  readonly warnings = new Map<string, number>()
  // A path that failed once is not downloaded again during the same run.
  private readonly failedPaths = new Set<string>()

  constructor(
    private readonly payload: Payload,
    private readonly assets: UpstreamAssetFetcher,
  ) {}

  async findOrCreate(sourcePath: string, alt: string, category: MediaCategory): Promise<number | undefined> {
    if (this.failedPaths.has(sourcePath)) return undefined

    const existing = await this.payload.find({
      collection: 'media',
      where: { sourcePath: { equals: sourcePath } },
      limit: 1,
      depth: 0,
    })
    const found = existing.docs[0]
    if (found) {
      // Realigns media imported before `category` existed, or recategorized by hand:
      // the upload pickers reject a media of the wrong category.
      if (found.category !== category) {
        await this.payload.update({
          collection: 'media',
          id: found.id,
          data: { category },
          context: SystemWorkflowContext.create(),
        })
        this.stats.recategorized++
      }
      this.stats.reused++
      return found.id
    }

    try {
      const file = await this.assets.fetch(sourcePath)
      const created = await this.payload.create({
        collection: 'media',
        data: { alt, category, sourcePath },
        file,
        context: SystemWorkflowContext.create(),
      })
      this.stats.created++
      return created.id
    } catch (err) {
      this.failedPaths.add(sourcePath)
      this.stats.failed++
      this.warn(`« ${sourcePath} » : ${UpstreamMediaImporter.describeFailure(err)}, média non importé`)
      return undefined
    }
  }

  private warn(warning: string): void {
    this.warnings.set(warning, (this.warnings.get(warning) ?? 0) + 1)
  }

  private static describeFailure(err: unknown): string {
    if (err instanceof UpstreamFetchError) {
      return err.isNotFound ? 'fichier introuvable en amont (404)' : `téléchargement refusé (HTTP ${err.status.toString()})`
    }
    return SyncErrorFormatter.format(err)
  }
}
