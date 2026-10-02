import type { Payload } from 'payload'
import type { CanonicalKey } from '@tee-backoffice/canonical'
import { CanonicalSyncPolicy } from '@/services/canonical/CanonicalSyncPolicy'
import { getCanonicalProgramService } from '@/services/canonical/canonicalProgramService'
import { getCanonicalProjectRepository } from '@/services/canonical/canonicalProjectRepository'
import { getCanonicalProjectService } from '@/services/canonical/canonicalProjectService'
import { getCanonicalProgramRepository } from '@/services/canonical/canonicalRepository'
import { CanonicalAlignment, type ExpectedCanonicalRow } from '@/services/upstream-sync/CanonicalAlignment'
import type { UpstreamRemovalGuard } from '@/services/upstream-sync/UpstreamRemovalGuard'
import type { WorkflowCollection } from '@/services/workflow/WorkflowTransitionPolicy'

export interface EntityReconciliation {
  /** Rows the CMS serves that the store does not hold: left for the next sync to rewrite. */
  missing: CanonicalKey[]
  /** Leftover rows withdrawn from the store. */
  removed: CanonicalKey[]
  /** Why the leftovers were kept, when the guard refused to withdraw them. */
  refused?: string
}

export interface ReconciliationReport {
  programs: EntityReconciliation
  projects: EntityReconciliation
  errors: number
}

type Remove = (canonicalId: string, slug: string) => Promise<void>

/**
 * Last step of a sync: checks that each canonical store holds what the CMS
 * serves, the CMS being their only writer. A leftover row (a withdrawal the
 * hook failed to carry out) is removed; a missing row is an error, which the
 * next sync repairs by rewriting the document.
 */
export class CanonicalReconciler {
  constructor(
    private readonly payload: Payload,
    private readonly guard: UpstreamRemovalGuard,
  ) {}

  async reconcile(): Promise<ReconciliationReport> {
    const logger = this.payload.logger
    const [programRepository, projectRepository, programService, projectService] = await Promise.all([
      getCanonicalProgramRepository(logger),
      getCanonicalProjectRepository(logger),
      getCanonicalProgramService(logger),
      getCanonicalProjectService(logger),
    ])

    const programs = await this.align(
      'dispositif',
      CanonicalAlignment.compare(await this.expected('programs'), await programRepository.listKeys()),
      (canonicalId, slug) => programService.remove(canonicalId, slug),
    )
    const projects = await this.align(
      'projet',
      CanonicalAlignment.compare(await this.expected('projects'), await projectRepository.listKeys()),
      (canonicalId, slug) => projectService.remove(canonicalId, slug),
    )

    const refusals = [programs, projects].filter((entity) => entity.refused !== undefined).length
    return { programs, projects, errors: programs.missing.length + projects.missing.length + refusals }
  }

  private async align(label: string, alignment: CanonicalAlignment, remove: Remove): Promise<EntityReconciliation> {
    const { missing, orphans, storedCount } = alignment
    if (!this.guard.allows(orphans.length, storedCount)) {
      return {
        missing,
        removed: [],
        refused: `${orphans.length.toString()} ${label}(s) du canonical inconnu(s) du CMS sur ${storedCount.toString()} stocké(s), limite ${this.guard.limitFor(storedCount).toString()}`,
      }
    }
    for (const orphan of orphans) await remove(orphan.canonicalId, orphan.slug)
    return { missing, removed: orphans }
  }

  /**
   * A document is read in its latest version, where a replaced or cancelled
   * status lives. One under rewrite may still be served under the id of its
   * main row, which stays allowed.
   */
  private async expected(collection: WorkflowCollection): Promise<ExpectedCanonicalRow[]> {
    const select = { slug: true, canonicalId: true, workflowStatus: true } as const
    const [latest, main] = await Promise.all([
      this.payload.find({ collection, draft: true, limit: 0, depth: 0, select }),
      this.payload.find({ collection, limit: 0, depth: 0, select }),
    ])
    const mainById = new Map(main.docs.map((doc) => [doc.id, doc]))

    const expected: ExpectedCanonicalRow[] = []
    for (const doc of latest.docs) {
      const action = CanonicalSyncPolicy.actionFor(doc.workflowStatus ?? 'en-creation')
      if (action === 'remove') continue
      const presence = action === 'save' ? 'required' : 'allowed'
      if (doc.canonicalId) expected.push({ canonicalId: doc.canonicalId, slug: doc.slug, presence })
      const mainId = mainById.get(doc.id)?.canonicalId
      if (action === 'keep' && mainId && mainId !== doc.canonicalId) {
        expected.push({ canonicalId: mainId, slug: doc.slug, presence: 'allowed' })
      }
    }
    return expected
  }
}
