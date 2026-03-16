import type { Payload } from 'payload'
import type { SourceProject } from './types'
import type { ProjectMapper } from './ProjectMapper'
import { ProgressBar } from '@/utils/ProgressBar'

export interface ImportResult {
  created: number
  updated: number
  errors: number
}

export class ProjectImporter {
  constructor(
    private readonly payload: Payload,
    private readonly mapper: ProjectMapper,
  ) {}

  async import(
    projects: SourceProject[],
  ): Promise<{ result: ImportResult; jsonIdToPayloadId: Map<number, number> }> {
    const existingIdBySlug = await this.fetchExisting(projects.map((p) => p.slug))
    const jsonIdToPayloadId = new Map<number, number>()

    const progress = new ProgressBar(projects.length)
    let created = 0
    let updated = 0
    let errors = 0

    await Promise.all(
      projects.map(async (project) => {
        try {
          const data = this.mapper.map(project)
          if (!data) {
            process.stderr.write(`Required fields missing for project "${project.slug}" — skipping.\n`)
            errors++
            return
          }

          const existingId = existingIdBySlug.get(project.slug)
          if (existingId !== undefined) {
            await this.payload.update({ collection: 'projects', id: existingId, data })
            jsonIdToPayloadId.set(project.id, existingId)
            updated++
          } else {
            const createdDoc = await this.payload.create({ collection: 'projects', data })
            jsonIdToPayloadId.set(project.id, createdDoc.id)
            created++
          }
        } catch (err) {
          process.stderr.write(`Error importing project "${project.slug}": ${String(err)}\n`)
          errors++
        } finally {
          progress.tick()
        }
      }),
    )

    progress.done()
    return { result: { created, updated, errors }, jsonIdToPayloadId }
  }

  private async fetchExisting(slugs: string[]): Promise<Map<string, number>> {
    const result = await this.payload.find({
      collection: 'projects',
      where: { slug: { in: slugs } },
      limit: slugs.length,
      depth: 0,
    })
    return new Map(result.docs.map((doc) => [doc.slug, doc.id]))
  }
}
