import type { Payload } from 'payload'
import { SlugCanonicalId } from '@tee-backoffice/format-adapters'
import type { ProjectRelations } from './ProjectRelations'

type RelatedCollection = 'programs' | 'projects'

/**
 * `ProjectRelations` backed by the programs and projects stored in Payload. A
 * document answers to its stored `canonicalId` and to the id the upstream reader
 * derives from its slug: the main row of a document the seed could only rewrite
 * as a draft keeps a former id, yet upstream still references it by slug.
 */
export class PayloadProjectRelations implements ProjectRelations {
  private constructor(
    private readonly payload: Payload,
    private readonly programIds: Map<string, number>,
    private projectIds: Map<string, number>,
  ) {}

  static async fromPayload(payload: Payload): Promise<PayloadProjectRelations> {
    const [programIds, projectIds] = await Promise.all([
      PayloadProjectRelations.idsByCanonicalId(payload, 'programs'),
      PayloadProjectRelations.idsByCanonicalId(payload, 'projects'),
    ])
    return new PayloadProjectRelations(payload, programIds, projectIds)
  }

  /** Projects created since the relations were loaded (first pass of the seed) become resolvable. */
  async refreshProjects(): Promise<void> {
    this.projectIds = await PayloadProjectRelations.idsByCanonicalId(this.payload, 'projects')
  }

  programIdByCanonicalId(canonicalId: string): number | undefined {
    return this.programIds.get(canonicalId)
  }

  projectIdByCanonicalId(canonicalId: string): number | undefined {
    return this.projectIds.get(canonicalId)
  }

  private static readonly SLUG_DERIVED_ID: Record<RelatedCollection, (slug: string) => string> = {
    programs: SlugCanonicalId.from,
    projects: SlugCanonicalId.forProject,
  }

  private static async idsByCanonicalId(payload: Payload, collection: RelatedCollection): Promise<Map<string, number>> {
    const result = await payload.find({
      collection,
      limit: 0,
      depth: 0,
      select: { canonicalId: true, slug: true },
    })
    const ids = new Map<string, number>()
    for (const doc of result.docs) {
      if (doc.canonicalId) ids.set(doc.canonicalId, doc.id)
    }
    // Set last: the id derived from a slug always names the document carrying that slug.
    const derive = PayloadProjectRelations.SLUG_DERIVED_ID[collection]
    for (const doc of result.docs) {
      if (doc.slug) ids.set(derive(doc.slug), doc.id)
    }
    return ids
  }
}
