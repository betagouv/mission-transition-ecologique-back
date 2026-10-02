import type { Payload } from 'payload'
import { readFileSync } from 'fs'
import type { CanonicalProjectInput } from '@tee-backoffice/canonical'
import {
  ProjectRedirects,
  ProjectTombstoneBuilder,
  SlugCanonicalId,
  TeeProjectImporter,
  teeProjectsSchema,
  type TeeProject,
} from '@tee-backoffice/format-adapters'
import { PayloadMarkdownToRichText } from '@/services/canonical/rich-text/PayloadMarkdownToRichText'
import { CanonicalProjectToPayloadMapper } from '@/services/canonical/to-payload/CanonicalProjectToPayloadMapper'
import { PayloadProjectRelations } from '@/services/canonical/to-payload/PayloadProjectRelations'
import { ProjectImporter, type ImportResult, type ProjectImport } from './ProjectImporter'
import { LinkedProjectsUpdater } from './LinkedProjectsUpdater'
import type { UpstreamMediaImporter } from '../media/UpstreamMediaImporter'
import { RedirectedDocuments } from '../RedirectedDocuments'
import { SyncErrorFormatter } from '../SyncErrorFormatter'

export interface ProjectsSyncOptions {
  /** Upstream slug redirects: each one becomes a `remplace` project of the CMS. */
  redirects?: ProjectRedirects
  /** Canonical ids the store holds (see `ProjectImporter`). */
  storedCanonicalIds?: ReadonlySet<string>
}

export interface ProjectsSyncResult extends ImportResult {
  /** Every slug upstream accounts for, redirected former slugs included. */
  snapshotSlugs: Set<string>
}

/**
 * Loads upstream `projects.json` records into the CMS. The raw format is read by
 * `TeeProjectImporter` only (the reader the canonical import uses too), then
 * `CanonicalProjectToPayloadMapper` turns each canonical project into Payload
 * data. The canonical store is fed along the way by the `Projects` hooks.
 * Redirects are applied the way the direct canonical import does, so the CMS
 * holds the replaced projects too. A former slug upstream no longer publishes
 * is cloned from its replacement, unless the CMS already holds a project under
 * it (see `RedirectedDocuments`).
 */
export class ProjectsSync {
  constructor(
    private readonly payload: Payload,
    private readonly projects: TeeProject[],
    // Without it (tests), project images are not imported.
    private readonly media?: UpstreamMediaImporter,
    private readonly options: ProjectsSyncOptions = {},
  ) {}

  static fromFile(payload: Payload, path: string, media?: UpstreamMediaImporter): ProjectsSync {
    return new ProjectsSync(payload, teeProjectsSchema.parse(JSON.parse(readFileSync(path, 'utf-8'))), media)
  }

  /** Pass 2 link failures count as errors: a partial import must not go unnoticed. */
  async run(): Promise<ProjectsSyncResult> {
    process.stdout.write(`Found ${this.projects.length.toString()} projects in source.\n`)

    const reader = new TeeProjectImporter()
    const projects = reader.importMany(this.projects, new Date().toISOString())

    const redirects = this.options.redirects ?? new ProjectRedirects(undefined)
    const { tombstones, markedInPlace, skipped } = new ProjectTombstoneBuilder().build(
      redirects,
      new Map(projects.map((project) => [project.slug, project])),
    )
    const former = await RedirectedDocuments.forProjects(this.payload, this.options.storedCanonicalIds).load(
      tombstones.map((tombstone) => tombstone.slug),
    )
    const stateOf = (project: CanonicalProjectInput) => former.stateOf(project.slug)
    const cloned = tombstones.filter((tombstone) => stateOf(tombstone) === 'absent' || stateOf(tombstone) === 'cloned')
    const kept = tombstones.filter((tombstone) => stateOf(tombstone) === 'published')
    const neverPublished = tombstones.filter((tombstone) => stateOf(tombstone) === 'unpublished')
    projects.push(...cloned)
    const isReplaced = (project: CanonicalProjectInput) => project.statut_projet === 'remplace'

    const relations = await PayloadProjectRelations.fromPayload(this.payload)
    const mapper = new CanonicalProjectToPayloadMapper(
      await PayloadMarkdownToRichText.create(this.payload.config),
      relations,
      this.slugLabels(),
    )

    process.stdout.write(`Pass 1: importing ${projects.length.toString()} projects...\n`)
    const importer = new ProjectImporter(
      this.payload,
      mapper,
      this.media,
      reader.unusableImagePaths,
      this.options.storedCanonicalIds,
    )
    const written = await importer.import(projects.filter((project) => !isReplaced(project)))
    // A replaced project points at its replacement, which must exist first.
    const replaced = projects.filter(isReplaced)
    if (replaced.length > 0 || kept.length > 0) await relations.refreshProjects()
    if (replaced.length > 0) ProjectsSync.merge(written, await importer.import(replaced))
    const { result } = written
    for (const tombstone of kept) {
      try {
        const replacement = relations.projectIdByCanonicalId(tombstone.remplace_par ?? '')
        if (replacement === undefined) throw new Error('projet remplaçant introuvable dans le CMS')
        result[await former.markReplaced(tombstone.slug, replacement)]++
      } catch (err) {
        process.stderr.write(`Error replacing project "${tombstone.slug}": ${SyncErrorFormatter.format(err)}\n`)
        result.errors++
      }
    }
    process.stdout.write(
      `Pass 1 complete: ${result.created.toString()} created, ${result.updated.toString()} updated, ${result.unchanged.toString()} unchanged, ${result.errors.toString()} errors.\n`,
    )
    if (redirects.size > 0) {
      process.stdout.write(
        `Redirections : ${markedInPlace.length.toString()} projet(s) marqué(s) en place, ${cloned.length.toString()} remplacé(s) cloné(s), ${kept.length.toString()} remplacé(s) avec leur contenu publié, ${neverPublished.length.toString()} jamais publié(s) à annuler, ${skipped.length.toString()} ignorée(s).\n`,
      )
      for (const skip of skipped) process.stdout.write(`  - ${skip.former} → ${skip.current} : ${skip.reason}\n`)
    }

    process.stdout.write('Pass 2: updating linked projects...\n')
    await relations.refreshProjects()
    const links = await new LinkedProjectsUpdater(this.payload, mapper).update(projects, written)
    process.stdout.write(
      `Pass 2 complete: ${links.updated.toString()} updated, ${links.errors.toString()} errors.\n`,
    )

    const warnings = [...reader.warnings, ...result.warnings, ...links.warnings]
    for (const warning of warnings) process.stdout.write(`  ⚠ ${warning}\n`)
    return {
      ...result,
      errors: result.errors + links.errors,
      warnings,
      // A former slug that was never published is left out: it is cancelled with the documents gone upstream.
      snapshotSlugs: new Set([...projects, ...kept].map((project) => project.slug)),
    }
  }

  private static merge(into: ProjectImport, other: ProjectImport): void {
    into.result.created += other.result.created
    into.result.updated += other.result.updated
    into.result.unchanged += other.result.unchanged
    into.result.errors += other.result.errors
    into.result.warnings.push(...other.result.warnings)
    for (const [canonicalId, id] of other.payloadIdByCanonicalId) into.payloadIdByCanonicalId.set(canonicalId, id)
    for (const [canonicalId, base] of other.fingerprintBases) into.fingerprintBases.set(canonicalId, base)
  }

  /** The pivot references programs and projects by ids derived from their slug: warnings name the slug. */
  private slugLabels(): (canonicalId: string) => string {
    const slugByCanonicalId = new Map<string, string>()
    for (const project of this.projects) {
      slugByCanonicalId.set(SlugCanonicalId.forProject(project.slug), project.slug)
      for (const slug of project.programs ?? []) slugByCanonicalId.set(SlugCanonicalId.from(slug), slug)
    }
    return (canonicalId) => slugByCanonicalId.get(canonicalId) ?? canonicalId
  }
}
