import type { Payload } from 'payload'
import type { TeeAdemeTheme } from '@tee-backoffice/format-adapters'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import { SyncErrorFormatter } from '../SyncErrorFormatter'

export interface AdemeThemesSyncResult {
  created: number
  updated: number
  unchanged: number
  /** Codes the CMS holds but upstream no longer publishes: kept, programs may still point at them. */
  stale: string[]
  errors: number
}

/**
 * Aligns the `ademe-themes` collection on the upstream referential, upserted by
 * code, before programs are imported so their `ademeThemes` resolve. A theme
 * upstream dropped is kept and reported rather than deleted.
 */
export class AdemeThemesSync {
  constructor(
    private readonly payload: Payload,
    private readonly themes: readonly TeeAdemeTheme[],
  ) {}

  async run(): Promise<AdemeThemesSyncResult> {
    const result: AdemeThemesSyncResult = { created: 0, updated: 0, unchanged: 0, stale: [], errors: 0 }
    const existing = await this.payload.find({ collection: 'ademe-themes', limit: 0, depth: 0 })
    const byCode = new Map(existing.docs.map((doc) => [doc.code, doc]))
    const idByCode = new Map(existing.docs.map((doc) => [doc.code, doc.id]))
    const context = SystemWorkflowContext.create()

    // Roots first: a sub-theme's parent must exist before it is linked.
    const ordered = [...this.themes].sort((a, b) => Number(a.parentCode !== null) - Number(b.parentCode !== null))
    for (const theme of ordered) {
      try {
        const parent = theme.parentCode === null ? null : idByCode.get(theme.parentCode)
        if (parent === undefined) throw new Error(`thématique parente ${String(theme.parentCode)} absente du référentiel`)
        const data = { code: theme.code, label: theme.label, parent }
        const current = byCode.get(theme.code)
        if (!current) {
          const created = await this.payload.create({ collection: 'ademe-themes', data, context })
          idByCode.set(theme.code, created.id)
          result.created++
        } else if (current.label !== theme.label || AdemeThemesSync.parentId(current.parent) !== parent) {
          await this.payload.update({ collection: 'ademe-themes', id: current.id, data, context })
          result.updated++
        } else {
          result.unchanged++
        }
      } catch (error) {
        result.errors++
        process.stderr.write(`  ✗ thématique ADEME ${theme.code} : ${SyncErrorFormatter.format(error)}\n`)
      }
    }

    const upstreamCodes = new Set(this.themes.map((theme) => theme.code))
    result.stale = existing.docs.map((doc) => doc.code).filter((code) => !upstreamCodes.has(code)).sort()
    this.report(result)
    return result
  }

  private static parentId(parent: number | { id: number } | null | undefined): number | null {
    if (parent == null) return null
    return typeof parent === 'object' ? parent.id : parent
  }

  private report(result: AdemeThemesSyncResult): void {
    process.stdout.write(
      `Thématiques ADEME : ${result.created.toString()} créées, ${result.updated.toString()} mises à jour, ${result.unchanged.toString()} inchangées.\n`,
    )
    if (result.stale.length > 0) {
      process.stdout.write(`  ⚠ absentes de l'amont, conservées : ${result.stale.join(', ')}\n`)
    }
  }
}
