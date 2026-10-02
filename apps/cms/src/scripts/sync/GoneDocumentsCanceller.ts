import type { Payload, Where } from 'payload'
import { SlugCanonicalId } from '@tee-backoffice/format-adapters'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import type { WorkflowCollection } from '@/services/workflow/WorkflowTransitionPolicy'
import type { UpstreamRemovalGuard } from '@/services/upstream-sync/UpstreamRemovalGuard'
import { SyncErrorFormatter } from './SyncErrorFormatter'
import type { GoneDocumentsReport } from './GoneDocumentsReport'

interface CancellableCollection {
  slug: WorkflowCollection
  /** French singular name of the entity, used in the refusal message. */
  label: string
  /** Canonical id the upstream import gives a document of this slug. */
  derivedId: (slug: string) => string
}

/**
 * Cancels (`annule`) the programs or the projects upstream no longer accounts
 * for: neither in its data file nor redirected. The hook then withdraws them
 * from the canonical store, while the CMS keeps the record and its history.
 * Only imported documents are concerned, recognised by their canonical id
 * derived from the slug: a document created in the CMS is never touched.
 */
export class GoneDocumentsCanceller {
  private constructor(
    private readonly payload: Payload,
    private readonly guard: UpstreamRemovalGuard,
    private readonly collection: CancellableCollection,
    // Restricts the documents looked at (the integration tests share one database).
    private readonly scope?: Where,
  ) {}

  static forPrograms(payload: Payload, guard: UpstreamRemovalGuard, scope?: Where): GoneDocumentsCanceller {
    const collection = { slug: 'programs' as const, label: 'dispositif', derivedId: SlugCanonicalId.from }
    return new GoneDocumentsCanceller(payload, guard, collection, scope)
  }

  static forProjects(payload: Payload, guard: UpstreamRemovalGuard, scope?: Where): GoneDocumentsCanceller {
    const collection = { slug: 'projects' as const, label: 'projet', derivedId: SlugCanonicalId.forProject }
    return new GoneDocumentsCanceller(payload, guard, collection, scope)
  }

  async cancel(snapshotSlugs: ReadonlySet<string>): Promise<GoneDocumentsReport> {
    const { slug: collection, label, derivedId } = this.collection
    // Latest versions: a document replaced or cancelled only says so there.
    const { docs } = await this.payload.find({
      collection,
      ...(this.scope ? { where: this.scope } : {}),
      draft: true,
      limit: 0,
      depth: 0,
      select: { slug: true, canonicalId: true, workflowStatus: true },
    })
    const active = docs.filter((doc) => doc.canonicalId === derivedId(doc.slug) && doc.workflowStatus !== 'annule')
    const gone = active.filter((doc) => !snapshotSlugs.has(doc.slug))

    if (!this.guard.allows(gone.length, active.length)) {
      return {
        cancelled: [],
        errors: 1,
        refused: `${gone.length.toString()} ${label}(s) disparu(s) de l'amont sur ${active.length.toString()} importé(s), limite ${this.guard.limitFor(active.length).toString()}`,
      }
    }

    const report: GoneDocumentsReport = { cancelled: [], errors: 0 }
    // Sequential: concurrent writes to `projects_rels` deadlock (see `LinkedProjectsUpdater`).
    for (const doc of gone) {
      try {
        await this.payload.update({
          collection,
          id: doc.id,
          data: { workflowStatus: 'annule', _status: 'draft', upstreamFingerprint: null },
          // Like the admin action: a cancellation is saved as a draft version.
          draft: true,
          context: SystemWorkflowContext.create(),
        })
        report.cancelled.push(doc.slug)
      } catch (err) {
        process.stderr.write(`Error cancelling ${label} "${doc.slug}": ${SyncErrorFormatter.format(err)}\n`)
        report.errors++
      }
    }
    return report
  }
}
