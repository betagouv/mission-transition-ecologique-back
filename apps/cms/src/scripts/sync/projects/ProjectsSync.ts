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
 * holds the replaced projects too.
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
    projects.push(...tombstones)
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
    if (replaced.length > 0) {
      await relations.refreshProjects()
      ProjectsSync.merge(written, await importer.import(replaced))
    }
    const { result } = written
    process.stdout.write(
      `Pass 1 complete: ${result.created.toString()} created, ${result.updated.toString()} updated, ${result.unchanged.toString()} unchanged, ${result.errors.toString()} errors.\n`,
    )
    if (redirects.size > 0) {
      process.stdout.write(
        `Redirections : ${markedInPlace.length.toString()} projet(s) marqué(s) en place, ${tombstones.length.toString()} remplacé(s) cloné(s), ${skipped.length.toString()} ignorée(s).\n`,
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
      snapshotSlugs: new Set(projects.map((project) => project.slug)),
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
