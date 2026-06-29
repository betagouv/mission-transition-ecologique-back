import type { Payload } from 'payload'
import { readFileSync } from 'fs'
import { editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { SourceProject } from './types'
import { ProjectMapper } from './ProjectMapper'
import { ProjectImporter } from './ProjectImporter'
import { LinkedProjectsUpdater } from './LinkedProjectsUpdater'

export class ProjectsSeed {
  constructor(
    private readonly payload: Payload,
    private readonly projectsPath: string,
  ) {}

  async run(): Promise<void> {
    process.stdout.write('Reading projects.json...\n')
    const projects = JSON.parse(readFileSync(this.projectsPath, 'utf-8')) as SourceProject[]
    process.stdout.write(`Found ${projects.length.toString()} projects in source file.\n`)

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
    const { result, jsonIdToPayloadId } = await new ProjectImporter(this.payload, mapper).import(projects)
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
  }
}
