import type { Payload } from 'payload'
import { readFileSync } from 'fs'
import type { CanonicalProgramInput } from '@tee-backoffice/canonical'
import {
  ProgramRedirects,
  RedirectTombstoneBuilder,
  SlugCanonicalId,
  TeeImporter,
  type RedirectSkip,
  type TeeOperator,
  type TeeRecord,
} from '@tee-backoffice/format-adapters'
import { PayloadMarkdownToRichText } from '@/services/canonical/rich-text/PayloadMarkdownToRichText'
import { CanonicalToPayloadMapper } from '@/services/canonical/to-payload/CanonicalToPayloadMapper'
import { PayloadProgramRelations } from '@/services/canonical/to-payload/PayloadProgramRelations'
import type { UpstreamMediaImporter } from '../media/UpstreamMediaImporter'
import { OperatorGroupImporter } from './OperatorGroupImporter'
import { OperatorImporter } from './OperatorImporter'
import { OperatorProfileImporter } from './OperatorProfileImporter'
import { ProgramImporter, type ImportResult } from './ProgramImporter'
import { RedirectedDocuments } from '../RedirectedDocuments'
import { SyncErrorFormatter } from '../SyncErrorFormatter'

/** Upstream `operators.json` entries and the importer that turns their logos into media. */
export interface OperatorProfilesInput {
  operators: TeeOperator[]
  media: UpstreamMediaImporter
}

export interface ProgramsSyncOptions {
  /** Upstream slug redirects: each one becomes a `remplace` program of the CMS. */
  redirects?: ProgramRedirects
  /** Canonical ids the store holds (see `ProgramImporter`). */
  storedCanonicalIds?: ReadonlySet<string>
}

export interface ProgramsSyncResult extends ImportResult {
  /** Every slug upstream accounts for, redirected former slugs included. */
  snapshotSlugs: Set<string>
}

/**
 * Loads upstream `programs.json` records into the CMS. The raw format is read by
 * `TeeImporter` only (the reader the canonical pipeline uses too), then
 * `CanonicalToPayloadMapper` turns each canonical program into Payload data.
 * Redirects are applied the way the direct canonical import does, so the CMS
 * holds the replaced programs too and the canonical gets them through the hook.
 * A former slug upstream no longer publishes is cloned from its replacement,
 * unless the CMS already holds a program under it (see `RedirectedDocuments`).
 */
export class ProgramsSync {
  constructor(
    private readonly payload: Payload,
    private readonly records: TeeRecord[],
    // Optional so a programs-only fixture can be seeded without operator profiles.
    private readonly operatorProfiles?: OperatorProfilesInput,
    private readonly options: ProgramsSyncOptions = {},
  ) {}

  static fromFile(payload: Payload, path: string): ProgramsSync {
    return new ProgramsSync(payload, JSON.parse(readFileSync(path, 'utf-8')) as TeeRecord[])
  }

  async run(): Promise<ProgramsSyncResult> {
    process.stdout.write(`Found ${this.records.length.toString()} programs in source.\n`)

    const importer = new TeeImporter()
    const programs = this.records.map((record) => {
      const input = importer.import(record)
      // Same id as the canonical import, so both writers address the same row.
      input.id = SlugCanonicalId.from(input.slug)
      return input
    })

    const redirects = this.options.redirects ?? new ProgramRedirects(undefined)
    const { tombstones, markedInPlace, skipped } = new RedirectTombstoneBuilder().build(
      redirects,
      new Map(programs.map((program) => [program.slug, program])),
    )
    const former = await RedirectedDocuments.forPrograms(this.payload, this.options.storedCanonicalIds).load(
      tombstones.map((tombstone) => tombstone.slug),
    )
    const stateOf = (program: CanonicalProgramInput) => former.stateOf(program.slug)
    const cloned = tombstones.filter((tombstone) => stateOf(tombstone) === 'absent' || stateOf(tombstone) === 'cloned')
    const kept = tombstones.filter((tombstone) => stateOf(tombstone) === 'published')
    const neverPublished = tombstones.filter((tombstone) => stateOf(tombstone) === 'unpublished')
    programs.push(...cloned)
    const isReplaced = (program: CanonicalProgramInput) => program.statut_dispositif === 'remplace'

    const operatorIdByName = await new OperatorImporter(this.payload).import(programs)
    await this.importOperatorProfiles()
    const relations = await PayloadProgramRelations.fromPayload(this.payload, operatorIdByName)
    const mapper = new CanonicalToPayloadMapper(await PayloadMarkdownToRichText.create(this.payload.config), relations)
    const programImporter = new ProgramImporter(this.payload, mapper, this.options.storedCanonicalIds)

    process.stdout.write(`Operators ready. Importing ${programs.length.toString()} programs...\n`)
    const result = await programImporter.import(programs.filter((program) => !isReplaced(program)))
    // A replaced program points at its replacement, which must exist first.
    const replaced = programs.filter(isReplaced)
    if (replaced.length > 0 || kept.length > 0) await relations.refreshPrograms()
    if (replaced.length > 0) ProgramsSync.merge(result, await programImporter.import(replaced))
    for (const tombstone of kept) {
      try {
        const replacement = relations.programIdByCanonicalId(tombstone.remplace_par ?? '')
        if (replacement === undefined) throw new Error('dispositif remplaçant introuvable dans le CMS')
        result[await former.markReplaced(tombstone.slug, replacement)]++
      } catch (err) {
        process.stderr.write(`Error replacing program "${tombstone.slug}": ${SyncErrorFormatter.format(err)}\n`)
        result.errors++
      }
    }

    process.stdout.write(
      `Programs complete: ${result.created.toString()} created, ${result.updated.toString()} updated, ${result.unchanged.toString()} unchanged, ${result.errors.toString()} errors.\n`,
    )
    this.reportRedirects(redirects, skipped, {
      inPlace: markedInPlace.length,
      cloned: cloned.length,
      kept: kept.length,
      neverPublished: neverPublished.length,
    })
    for (const [warning, count] of result.warnings) {
      process.stdout.write(`  ⚠ ${count.toString()} × ${warning}\n`)
    }
    // A former slug that was never published is left out: it is cancelled with the documents gone upstream.
    return { ...result, snapshotSlugs: new Set([...programs, ...kept].map((program) => program.slug)) }
  }

  private static merge(into: ImportResult, other: ImportResult): void {
    into.created += other.created
    into.updated += other.updated
    into.unchanged += other.unchanged
    into.errors += other.errors
    for (const [warning, count] of other.warnings) into.warnings.set(warning, (into.warnings.get(warning) ?? 0) + count)
  }

  private reportRedirects(
    redirects: ProgramRedirects,
    skipped: RedirectSkip[],
    counts: { inPlace: number; cloned: number; kept: number; neverPublished: number },
  ): void {
    if (redirects.size === 0) return
    process.stdout.write(
      `Redirections : ${counts.inPlace.toString()} dispositif(s) marqué(s) en place, ${counts.cloned.toString()} remplacé(s) cloné(s), ${counts.kept.toString()} remplacé(s) avec leur contenu publié, ${counts.neverPublished.toString()} jamais publié(s) à annuler, ${skipped.length.toString()} ignorée(s).\n`,
    )
    for (const skip of skipped) process.stdout.write(`  - ${skip.former} → ${skip.current} : ${skip.reason}\n`)
  }

  private async importOperatorProfiles(): Promise<void> {
    if (!this.operatorProfiles) return
    const { operators, media } = this.operatorProfiles

    const groupIdByName = await new OperatorGroupImporter(this.payload, media).import(operators)
    const profiles = await new OperatorProfileImporter(this.payload, media).import(operators, groupIdByName)
    process.stdout.write(
      `Operator groups ready: ${groupIdByName.size.toString()} groups, ${profiles.updated.toString()} operators updated.\n`,
    )
    for (const [warning, count] of profiles.warnings) {
      process.stdout.write(`  ⚠ ${count.toString()} × ${warning}\n`)
    }
  }
}
