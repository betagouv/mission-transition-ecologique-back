import type { Payload } from 'payload'
import type { WorkflowStatus } from './WorkflowTransitionPolicy'

export interface AutomationContext {
  payload: Payload
  programId: string | number
  validityStart?: Date | string | null
}

export class WorkflowAutomation {
  /**
   * Runs the post-`en-cours-publication` automated pipeline.
   * Returns the next workflow status, or `null` to stay in `en-cours-publication`.
   */
  static runPublishingPipeline(_ctx: AutomationContext): WorkflowStatus | null {
    // TODO(workflow): trigger publication mailing (mission-transition-ecologique#2604)
    // TODO(workflow): if validityStart > today, return null and persist 'en-cours-publication'
    return 'publie'
  }
}
