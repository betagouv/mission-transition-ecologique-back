import type { CollectionBeforeChangeHook } from 'payload'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

/**
 * `upstreamFingerprint` tells the daily sync that a document still holds what
 * upstream last provided. Any other write (an editor, the REST API) clears it,
 * so the next sync rewrites the document: upstream is master.
 */
export const clearUpstreamFingerprint: CollectionBeforeChangeHook = ({ data, req }) => {
  if (!SystemWorkflowContext.isActive(req.context)) data.upstreamFingerprint = null
  return data
}
