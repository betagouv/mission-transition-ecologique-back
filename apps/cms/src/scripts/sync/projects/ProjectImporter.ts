import type { Payload } from 'payload'
import type { CanonicalProjectInput } from '@tee-backoffice/canonical'
import type { CanonicalProjectToPayloadMapper } from '@/services/canonical/to-payload/CanonicalProjectToPayloadMapper'
import { UpstreamFingerprint } from '@/services/upstream-sync/UpstreamFingerprint'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import { ImportedMediaPolicy } from '../media/ImportedMediaPolicy'
import type { UpstreamMediaImporter } from '../media/UpstreamMediaImporter'
import type { Project } from '../../../../payload-types'
import { ProgressBar } from '@/utils/ProgressBar'
import { SyncErrorFormatter } from '../SyncErrorFormatter'

export interface ImportResult {
  created: number
  updated: number
  /** Projects left alone: they already hold what upstream provides. */
  unchanged: number
  errors: number
  /** Upstream data the CMS could not take in, reported at the end of the seed. */
  warnings: string[]
}

export interface ProjectImport {
  result: ImportResult
  /** Payload id of each project written, by canonical id. */
  payloadIdByCanonicalId: Map<string, number>
  /**
   * What the fingerprint of each written project is made of, by canonical id,
   * its links aside: the second pass completes it once they are resolved.
   */
  fingerprintBases: Map<string, Record<string, unknown>>
}

/** Published image and links (main row), and the fingerprint of the latest version. */
type ExistingProject = Pick<Project, 'id' | 'image' | 'linkedProjects' | 'upstreamFingerprint'>

export class ProjectImporter {
  constructor(
    private readonly payload: Payload,
    private readonly mapper: CanonicalProjectToPayloadMapper,
    private readonly media?: UpstreamMediaImporter,
    // Upstream image paths the reader could not use, by slug (see `TeeProjectImporter.unusableImagePaths`).
    private readonly unusableImagePaths: ReadonlyMap<string, string> = new Map(),
    // Canonical ids the store holds: a project missing from it is rewritten even
    // when unchanged, so a failed canonical sync heals on the next run. Without
    // it, the store is not looked at.
    private readonly storedCanonicalIds?: ReadonlySet<string>,
  ) {}

  async import(projects: CanonicalProjectInput[]): Promise<ProjectImport> {
    const existingBySlug = await this.fetchExisting(projects.map((p) => p.slug))
    const payloadIdByCanonicalId = new Map<string, number>()
    const fingerprintBases = new Map<string, Record<string, unknown>>()

    const progress = new ProgressBar(projects.length)
    const result: ImportResult = { created: 0, updated: 0, unchanged: 0, errors: 0, warnings: [] }

    // Sequential on purpose: concurrent writes to `projects_rels` can deadlock
    // on Postgres (see `LinkedProjectsUpdater`).
    for (const project of projects) {
      try {
        const existing = existingBySlug.get(project.slug)
        const { data: mapped, warnings } = this.mapper.map(project)
        result.warnings.push(...warnings.map((warning) => `${project.slug} : ${warning}`))

        const image = await this.nextImage(project, existing?.image)
        // Always written, like the mapped fields: a field left out would take
        // the value of a pending draft and publish it.
        const base = { ...mapped, image: image === undefined ? ProjectImporter.relationId(existing?.image) : image }
        const hasLinks = ProjectImporter.hasLinkedProjects(project)

        // The links are compared as the CMS resolves them now: one that becomes
        // resolvable later changes the fingerprint and rewrites the project.
        const links = hasLinks ? this.mapper.mapLinkedProjects(project) : { linkedProjects: [], warnings: [] }
        const fingerprint = UpstreamFingerprint.of({ ...base, linkedProjects: links.linkedProjects })
        if (existing?.upstreamFingerprint === fingerprint && this.isStored(project.id)) {
          result.warnings.push(...links.warnings.map((warning) => `${project.slug} : ${warning}`))
          result.unchanged++
          continue
        }

        const data = {
          ...base,
          // Links upstream dropped are cleared here; the others keep their
          // published value until the second pass sets the upstream one.
          linkedProjects: hasLinks
            ? (existing?.linkedProjects ?? []).map((linked) => (typeof linked === 'object' ? linked.id : linked))
            : [],
          // A project with links is only up to date once the second pass has written them.
          upstreamFingerprint: hasLinks ? null : fingerprint,
        }
        // As the system, so `assignCanonicalId` takes the id derived from the slug
        // and the upstream status wins over the editorial workflow.
        const context = SystemWorkflowContext.create()
        // Like `ProgramImporter`: only a project that is not published (replaced)
        // is saved as a draft, which skips the validation of its former slug.
        const draft = data._status !== 'published'

        if (existing) {
          await this.payload.update({ collection: 'projects', id: existing.id, data, draft, context })
          payloadIdByCanonicalId.set(project.id, existing.id)
          result.updated++
        } else {
          const createdDoc = await this.payload.create({ collection: 'projects', data, draft, context })
          payloadIdByCanonicalId.set(project.id, createdDoc.id)
          result.created++
        }
        fingerprintBases.set(project.id, base)
      } catch (err) {
        process.stderr.write(`Error importing project "${project.slug}": ${SyncErrorFormatter.format(err)}\n`)
        result.errors++
      } finally {
        progress.tick()
      }
    }

    progress.done()
    return { result, payloadIdByCanonicalId, fingerprintBases }
  }

  static hasLinkedProjects(project: CanonicalProjectInput): boolean {
    return (project.projets_lies?.projets.length ?? 0) > 0
  }

  private isStored(canonicalId: string): boolean {
    return !this.storedCanonicalIds || this.storedCanonicalIds.has(canonicalId)
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

  /**
   * The image and the links come from the main rows (published values), never
   * from a pending draft: the image is populated for `ImportedMediaPolicy`. The
   * fingerprint comes from the latest versions, where a replaced project and an
   * editor's pending draft keep theirs.
   */
  private async fetchExisting(slugs: string[]): Promise<Map<string, ExistingProject>> {
    const where = { slug: { in: slugs } }
    const [main, latest] = await Promise.all([
      this.payload.find({
        collection: 'projects',
        where,
        limit: slugs.length,
        depth: 1,
        select: { slug: true, image: true, linkedProjects: true },
        // Linked projects are only needed as ids.
        populate: { projects: { slug: true } },
      }),
      this.payload.find({
        collection: 'projects',
        where,
        limit: slugs.length,
        depth: 0,
        draft: true,
        select: { slug: true, upstreamFingerprint: true },
      }),
    ])
    const fingerprintById = new Map(latest.docs.map((doc) => [doc.id, doc.upstreamFingerprint]))
    return new Map(
      main.docs.map((doc) => [
        doc.slug,
        {
          id: doc.id,
          image: doc.image,
          linkedProjects: doc.linkedProjects,
          upstreamFingerprint: fingerprintById.get(doc.id),
        },
      ]),
    )
  }
}
