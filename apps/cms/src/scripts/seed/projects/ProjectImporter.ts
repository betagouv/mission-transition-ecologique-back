import type { Payload } from 'payload'
import type { CanonicalProjectInput } from '@tee-backoffice/canonical'
import type { CanonicalProjectToPayloadMapper } from '@/services/canonical/to-payload/CanonicalProjectToPayloadMapper'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import { ImportedMediaPolicy } from '../media/ImportedMediaPolicy'
import type { UpstreamMediaImporter } from '../media/UpstreamMediaImporter'
import type { Project } from '../../../../payload-types'
import { ProgressBar } from '@/utils/ProgressBar'
import { SeedErrorFormatter } from '../SeedErrorFormatter'

export interface ImportResult {
  created: number
  updated: number
  errors: number
  /** Upstream data the CMS could not take in, reported at the end of the seed. */
  warnings: string[]
}

export interface ProjectImport {
  result: ImportResult
  /** Payload id of each project written, by canonical id. */
  payloadIdByCanonicalId: Map<string, number>
}

type ExistingProject = Pick<Project, 'id' | 'image' | 'linkedProjects'>

export class ProjectImporter {
  constructor(
    private readonly payload: Payload,
    private readonly mapper: CanonicalProjectToPayloadMapper,
    private readonly media?: UpstreamMediaImporter,
    // Upstream image paths the reader could not use, by slug (see `TeeProjectImporter.unusableImagePaths`).
    private readonly unusableImagePaths: ReadonlyMap<string, string> = new Map(),
  ) {}

  async import(projects: CanonicalProjectInput[]): Promise<ProjectImport> {
    const existingBySlug = await this.fetchExisting(projects.map((p) => p.slug))
    const payloadIdByCanonicalId = new Map<string, number>()

    const progress = new ProgressBar(projects.length)
    const result: ImportResult = { created: 0, updated: 0, errors: 0, warnings: [] }

    // Sequential on purpose: concurrent writes to `projects_rels` can deadlock
    // on Postgres (see `LinkedProjectsUpdater`).
    for (const project of projects) {
      try {
        const existing = existingBySlug.get(project.slug)
        const { data: mapped, warnings } = this.mapper.map(project)
        result.warnings.push(...warnings.map((warning) => `${project.slug} : ${warning}`))

        const image = await this.nextImage(project, existing?.image)
        // Both fields are always written, like the mapped ones: a field left out
        // would take the value of a pending draft and publish it.
        const data = {
          ...mapped,
          image: image === undefined ? ProjectImporter.relationId(existing?.image) : image,
          // Links upstream dropped are cleared here; the others keep their
          // published value until the second pass sets the upstream one.
          linkedProjects: ProjectImporter.hasLinkedProjects(project)
            ? (existing?.linkedProjects ?? []).map((linked) => (typeof linked === 'object' ? linked.id : linked))
            : [],
        }
        // As the system, so `assignCanonicalId` takes the id derived from the slug,
        // the one the daily canonical import writes under.
        const context = SystemWorkflowContext.create()

        if (existing) {
          await this.payload.update({ collection: 'projects', id: existing.id, data, context })
          payloadIdByCanonicalId.set(project.id, existing.id)
          result.updated++
        } else {
          const createdDoc = await this.payload.create({ collection: 'projects', data, context })
          payloadIdByCanonicalId.set(project.id, createdDoc.id)
          result.created++
        }
      } catch (err) {
        process.stderr.write(`Error importing project "${project.slug}": ${SeedErrorFormatter.format(err)}\n`)
        result.errors++
      } finally {
        progress.tick()
      }
    }

    progress.done()
    return { result, payloadIdByCanonicalId }
  }

  static hasLinkedProjects(project: CanonicalProjectInput): boolean {
    return (project.projets_lies?.projets.length ?? 0) > 0
  }

  /** Same rule as the operator logos (see `ImportedMediaPolicy`); no importer means images are left alone. */
  private async nextImage(
    project: CanonicalProjectInput,
    current: Project['image'],
  ): Promise<number | null | undefined> {
    const media = this.media
    if (!media) return undefined
    // A path the reader refused still reaches the download, which fails and is
    // counted: the current image is kept, not cleared as if upstream had dropped it.
    const upstreamPath = project.image?.chemin_source ?? this.unusableImagePaths.get(project.slug)
    return ImportedMediaPolicy.nextValue(current, upstreamPath, (path) =>
      media.findOrCreate(path, project.titre || project.slug, 'project-image'),
    )
  }

  private static relationId(value: number | { id: number } | null | undefined): number | null {
    if (value === null || value === undefined) return null
    return typeof value === 'object' ? value.id : value
  }

  /** Main rows (published values), never a pending draft: the image is populated for `ImportedMediaPolicy`. */
  private async fetchExisting(slugs: string[]): Promise<Map<string, ExistingProject>> {
    const result = await this.payload.find({
      collection: 'projects',
      where: { slug: { in: slugs } },
      limit: slugs.length,
      depth: 1,
      select: { slug: true, image: true, linkedProjects: true },
      // Linked projects are only needed as ids.
      populate: { projects: { slug: true } },
    })
    return new Map(
      result.docs.map((doc) => [doc.slug, { id: doc.id, image: doc.image, linkedProjects: doc.linkedProjects }]),
    )
  }
}
