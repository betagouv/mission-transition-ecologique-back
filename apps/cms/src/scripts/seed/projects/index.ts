import type { Payload } from 'payload'
import { readFileSync } from 'fs'
import { editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { SourceProject } from './types'
import { ProjectMapper } from './ProjectMapper'
import { ProjectImporter, type ImportResult } from './ProjectImporter'
import { LinkedProjectsUpdater } from './LinkedProjectsUpdater'
import type { UpstreamMediaImporter } from '../media/UpstreamMediaImporter'

export class ProjectsSeed {
  constructor(
    private readonly payload: Payload,
    private readonly projects: SourceProject[],
    // Without it (tests), project images are not imported.
    private readonly media?: UpstreamMediaImporter,
  ) {}

  static fromFile(payload: Payload, path: string, media?: UpstreamMediaImporter): ProjectsSeed {
    return new ProjectsSeed(payload, JSON.parse(readFileSync(path, 'utf-8')) as SourceProject[], media)
  }

  /** Pass 2 link failures count as errors: a partial seed must not go unnoticed. */
  async run(): Promise<ImportResult> {
    const projects = this.projects
    process.stdout.write(`Found ${projects.length.toString()} projects in source.\n`)

    const programsResult = await this.payload.find({
      collection: 'programs',
      limit: 0,
      depth: 0,
    })
    const programIdBySlug = new Map<string, number>(
      programsResult.docs.map((doc) => [doc.slug, doc.id]),
    )
    process.stdout.write(`Found ${programIdBySlug.size.toString()} programs for relation mapping.\n`)

    const editorConfig = await editorConfigFactory.default({ config: this.payload.config })
    const mapper = new ProjectMapper(editorConfig, programIdBySlug)

    process.stdout.write(`Pass 1: importing ${projects.length.toString()} projects...\n`)
    const { result, jsonIdToPayloadId } = await new ProjectImporter(this.payload, mapper, this.media).import(projects)
    process.stdout.write(
      `Pass 1 complete — ${result.created.toString()} created, ${result.updated.toString()} updated, ${result.errors.toString()} errors.\n`,
    )

    process.stdout.write('Pass 2: updating linked projects...\n')
    const { updated, errors } = await new LinkedProjectsUpdater(this.payload).update(
      projects,
      jsonIdToPayloadId,
    )
    process.stdout.write(
      `Pass 2 complete — ${updated.toString()} updated, ${errors.toString()} errors.\n`,
    )
    return { ...result, errors: result.errors + errors }
  }
}
