import type { WorkflowStatus } from '@/services/workflow/WorkflowTransitionPolicy'

export type CanonicalSyncAction = 'save' | 'remove' | 'keep'

/**
 * Decides what a program save means for the canonical store, from its workflow
 * status. Archived and replaced programs are pushed with that status: AGIR keeps
 * serving them flagged as such, the Grist open data export leaves them out.
 * In-progress states keep the canonical untouched, so a published program under
 * rewrite stays live.
 */
export class CanonicalSyncPolicy {
  private static readonly ACTIONS: Record<WorkflowStatus, CanonicalSyncAction> = {
    publie: 'save',
    archive: 'save',
    remplace: 'save',
    annule: 'remove',
    'en-creation': 'keep',
    'en-relecture': 'keep',
    'en-cours-publication': 'keep',
    'en-cours-modification': 'keep',
    importe: 'keep',
  }

  static actionFor(status: WorkflowStatus): CanonicalSyncAction {
    return CanonicalSyncPolicy.ACTIONS[status]
  }
}
