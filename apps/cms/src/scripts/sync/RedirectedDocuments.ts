import type { Payload } from 'payload'
import { UpstreamFingerprint } from '@/services/upstream-sync/UpstreamFingerprint'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import type { WorkflowCollection } from '@/services/workflow/WorkflowTransitionPolicy'

/**
 * What the CMS holds under a former slug upstream redirects and no longer publishes:
 *  - `absent`: nothing, the replaced document is cloned from its replacement;
 *  - `cloned`: a clone written by a previous run, kept in line with its replacement;
 *  - `published`: a document that was published, which keeps its own content;
 *  - `unpublished`: a document that never was, left to the cancellation of gone documents.
 */
export type FormerDocumentState = 'absent' | 'cloned' | 'published' | 'unpublished'

interface FormerDocument {
  id: number
  state: Exclude<FormerDocumentState, 'absent'>
  workflowStatus: string | null | undefined
  fingerprint: string | null | undefined
  canonicalId: string | null | undefined
}

/**
 * Documents of the CMS whose slug upstream now redirects, once their record has
 * left the upstream file. One that was published keeps its published content:
 * it is only marked `remplace` and pointed at its replacement, in a draft
 * version like the admin action, and a pending draft is dropped. The canonical
 * never held a document that was not published, so there is nothing to redirect.
 */
export class RedirectedDocuments {
  private readonly documents = new Map<string, FormerDocument>()

  private constructor(
    private readonly payload: Payload,
    private readonly collection: WorkflowCollection,
    // Canonical ids the store holds (see `ProgramImporter`).
    private readonly storedCanonicalIds?: ReadonlySet<string>,
  ) {}

  static forPrograms(payload: Payload, storedCanonicalIds?: ReadonlySet<string>): RedirectedDocuments {
    return new RedirectedDocuments(payload, 'programs', storedCanonicalIds)
  }

  static forProjects(payload: Payload, storedCanonicalIds?: ReadonlySet<string>): RedirectedDocuments {
    return new RedirectedDocuments(payload, 'projects', storedCanonicalIds)
  }

  async load(formerSlugs: string[]): Promise<this> {
    if (formerSlugs.length === 0) return this
    const query = { collection: this.collection, where: { slug: { in: formerSlugs } }, limit: 0, depth: 0 }
    const [latest, published] = await Promise.all([
      // Latest versions: where a replaced or cancelled document says so.
      this.payload.find({
        ...query,
        draft: true,
        select: { slug: true, workflowStatus: true, replacedBy: true, upstreamFingerprint: true, canonicalId: true },
      }),
      this.payload.find({ ...query, draft: false, select: { _status: true } }),
    ])
    const publishedIds = new Set(published.docs.filter((doc) => doc._status === 'published').map((doc) => doc.id))

    for (const doc of latest.docs) {
      // A document that was never published but carries a replacement is a clone:
      // it keeps `replacedBy` when it is cancelled.
      const isClone = doc.workflowStatus === 'remplace' || (doc.replacedBy ?? null) !== null
      this.documents.set(doc.slug, {
        id: doc.id,
        state: publishedIds.has(doc.id) ? 'published' : isClone ? 'cloned' : 'unpublished',
        workflowStatus: doc.workflowStatus,
        fingerprint: doc.upstreamFingerprint,
        canonicalId: doc.canonicalId,
      })
    }
    return this
  }

  stateOf(formerSlug: string): FormerDocumentState {
    return this.documents.get(formerSlug)?.state ?? 'absent'
  }

  /** Marks a published document `remplace`, on top of its published content. */
  async markReplaced(formerSlug: string, replacedBy: number): Promise<'updated' | 'unchanged'> {
    const document = this.documents.get(formerSlug)
    if (document?.state !== 'published') throw new Error(`« ${formerSlug} » n'a pas de version publiée à conserver`)

    const fingerprint = UpstreamFingerprint.of({ keepsPublishedContent: true, replacedBy })
    const isStored =
      !this.storedCanonicalIds || (Boolean(document.canonicalId) && this.storedCanonicalIds.has(document.canonicalId as string))
    if (document.workflowStatus === 'remplace' && document.fingerprint === fingerprint && isStored) return 'unchanged'

    // `find`, not `findByID`: the main row, without the virtual fields a single read computes.
    const { docs } = await this.payload.find({
      collection: this.collection,
      where: { id: { equals: document.id } },
      draft: false,
      depth: 0,
      limit: 1,
    })
    const published = docs[0]
    if (!published) throw new Error(`« ${formerSlug} » introuvable`)
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...content } = published

    await this.payload.update({
      collection: this.collection,
      id: document.id,
      // Every published field is written back: an update starts from the latest version, a pending draft included.
      data: { ...content, workflowStatus: 'remplace', replacedBy, _status: 'draft', upstreamFingerprint: fingerprint },
      draft: true,
      context: SystemWorkflowContext.create(),
    })
    return 'updated'
  }
}
