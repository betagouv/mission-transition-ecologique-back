import type { CollectionAfterDeleteHook } from 'payload'
import { getCanonicalProjectService } from '@/services/canonical/canonicalProjectService'
import { getCanonicalEventSink } from '@/services/canonical/observability/canonicalEventSink'
import type { Project } from '../../../payload-types'

/**
 * Withdraws a deleted project from the canonical store, so external consumers
 * stop serving it. Like the save sync, it never blocks the CMS delete.
 */
export const removeProjectCanonicalOnDelete: CollectionAfterDeleteHook<Project> = async ({ doc, req }) => {
  if (!doc.canonicalId) return doc

  try {
    const service = await getCanonicalProjectService(req.payload.logger)
    await service.remove(doc.canonicalId, String(doc.slug ?? ''))
  } catch (error) {
    getCanonicalEventSink(req.payload.logger).emit({
      type: 'sync_failed',
      severity: 'error',
      entity: 'project',
      slug: String(doc.slug ?? ''),
      error: (error as Error).message,
    })
  }

  return doc
}
