import type { Payload } from 'payload'
import { readFileSync } from 'fs'
import { SlugCanonicalId, TeeProjectImporter, teeProjectsSchema, type TeeProject } from '@tee-backoffice/format-adapters'
import { PayloadMarkdownToRichText } from '@/services/canonical/rich-text/PayloadMarkdownToRichText'
import { CanonicalProjectToPayloadMapper } from '@/services/canonical/to-payload/CanonicalProjectToPayloadMapper'
import { PayloadProjectRelations } from '@/services/canonical/to-payload/PayloadProjectRelations'
import { ProjectImporter, type ImportResult } from './ProjectImporter'
import { LinkedProjectsUpdater } from './LinkedProjectsUpdater'
import type { UpstreamMediaImporter } from '../media/UpstreamMediaImporter'

/**
 * Loads upstream `projects.json` records into the CMS. The raw format is read by
 * `TeeProjectImporter` only (the reader the canonical import uses too), then
 * `CanonicalProjectToPayloadMapper` turns each canonical project into Payload
 * data. The canonical store is fed along the way by the `Projects` hooks.
 */
export class ProjectsSeed {
  constructor(
    private readonly payload: Payload,
    private readonly projects: TeeProject[],
    // Without it (tests), project images are not imported.
    private readonly media?: UpstreamMediaImporter,
  ) {}

  static fromFile(payload: Payload, path: string, media?: UpstreamMediaImporter): ProjectsSeed {
    return new ProjectsSeed(payload, teeProjectsSchema.parse(JSON.parse(readFileSync(path, 'utf-8'))), media)
  }

  /** Pass 2 link failures count as errors: a partial seed must not go unnoticed. */
  async run(): Promise<ImportResult> {
    process.stdout.write(`Found ${this.projects.length.toString()} projects in source.\n`)

    const reader = new TeeProjectImporter()
    const projects = reader.importMany(this.projects, new Date().toISOString())

    const relations = await PayloadProjectRelations.fromPayload(this.payload)
    const mapper = new CanonicalProjectToPayloadMapper(
      await PayloadMarkdownToRichText.create(this.payload.config),
      relations,
      this.slugLabels(),
    )

    process.stdout.write(`Pass 1: importing ${projects.length.toString()} projects...\n`)
    const { result, payloadIdByCanonicalId } = await new ProjectImporter(
      this.payload,
      mapper,
      this.media,
      reader.unusableImagePaths,
    ).import(projects)
    process.stdout.write(
      `Pass 1 complete: ${result.created.toString()} created, ${result.updated.toString()} updated, ${result.errors.toString()} errors.\n`,
    )

    process.stdout.write('Pass 2: updating linked projects...\n')
    await relations.refreshProjects()
    const links = await new LinkedProjectsUpdater(this.payload, mapper).update(projects, payloadIdByCanonicalId)
    process.stdout.write(
      `Pass 2 complete: ${links.updated.toString()} updated, ${links.errors.toString()} errors.\n`,
    )

    const warnings = [...reader.warnings, ...result.warnings, ...links.warnings]
    for (const warning of warnings) process.stdout.write(`  ⚠ ${warning}\n`)
    return { ...result, errors: result.errors + links.errors, warnings }
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
