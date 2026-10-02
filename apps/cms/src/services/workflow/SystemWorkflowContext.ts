import type { RequestContext } from 'payload'

/**
 * Marks a write as issued by a trusted script (daily upstream sync, seed) rather
 * than by an editor. Passed through Payload's `context`, which only server code
 * can set: a REST client cannot forge it.
 */
export class SystemWorkflowContext {
  private static readonly KEY = 'systemWorkflow'

  static create(): RequestContext {
    return { [SystemWorkflowContext.KEY]: true }
  }

  static isActive(context: RequestContext | undefined): boolean {
    return context?.[SystemWorkflowContext.KEY] === true
  }
}
