import type { Payload } from 'payload'
import type { SourceProject } from './types'
import type { ProjectMapper } from './ProjectMapper'
import { ImportedMediaPolicy } from '../media/ImportedMediaPolicy'
import type { UpstreamMediaImporter } from '../media/UpstreamMediaImporter'
import type { Project } from '../../../../payload-types'
import { ProgressBar } from '@/utils/ProgressBar'
import { SeedErrorFormatter } from '../SeedErrorFormatter'

export interface ImportResult {
  created: number
  updated: number
  errors: number
}

export class ProjectImporter {
  constructor(
    private readonly payload: Payload,
    private readonly mapper: ProjectMapper,
    private readonly media?: UpstreamMediaImporter,
  ) {}

  async import(
    projects: SourceProject[],
  ): Promise<{ result: ImportResult; jsonIdToPayloadId: Map<number, number> }> {
    const existingBySlug = await this.fetchExisting(projects.map((p) => p.slug))
    const jsonIdToPayloadId = new Map<number, number>()

    const progress = new ProgressBar(projects.length)
    let created = 0
    let updated = 0
    let errors = 0

    // Sequential on purpose: concurrent writes to `projects_rels` can deadlock
    // on Postgres (see `LinkedProjectsUpdater`).
    for (const project of projects) {
      try {
        const existing = existingBySlug.get(project.slug)
        const image = await this.nextImage(project, existing?.image)
        const mapped = this.mapper.map(project)
        if (!mapped) {
          process.stderr.write(`Required fields missing for project "${project.slug}" — skipping.\n`)
          errors++
          continue
        }
        const data = image === undefined ? mapped : { ...mapped, image }

        const existingId = existing?.id
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
        process.stderr.write(`Error importing project "${project.slug}": ${SeedErrorFormatter.format(err)}\n`)
        errors++
      } finally {
        progress.tick()
      }
    }

    progress.done()
    return { result: { created, updated, errors }, jsonIdToPayloadId }
  }

  /** Same rule as the operator logos (see `ImportedMediaPolicy`); no importer means images are left alone. */
  private async nextImage(project: SourceProject, current: Project['image']): Promise<number | null | undefined> {
    const media = this.media
    if (!media) return undefined
    return ImportedMediaPolicy.nextValue(current, project.image, (path) =>
      media.findOrCreate(path, project.title || project.slug, 'project-image'),
    )
  }

  private async fetchExisting(slugs: string[]): Promise<Map<string, Pick<Project, 'id' | 'image'>>> {
    const result = await this.payload.find({
      collection: 'projects',
      where: { slug: { in: slugs } },
      limit: slugs.length,
      depth: 1,
      select: { slug: true, image: true },
    })
    return new Map(result.docs.map((doc) => [doc.slug, { id: doc.id, image: doc.image }]))
  }
}
