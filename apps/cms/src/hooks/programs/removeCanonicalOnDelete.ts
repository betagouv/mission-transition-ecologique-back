import type { CollectionAfterDeleteHook } from 'payload'
import { getCanonicalProgramService } from '@/services/canonical/canonicalProgramService'
import { getCanonicalEventSink } from '@/services/canonical/observability/canonicalEventSink'
import type { Program } from '../../../payload-types'

/**
 * Withdraws a hard-deleted program from the canonical store, so external
 * consumers stop serving it. Like the save sync, it never blocks the CMS delete.
 */
export const removeCanonicalOnDelete: CollectionAfterDeleteHook<Program> = async ({ doc, req }) => {
  if (!doc.canonicalId) return doc

  try {
    const service = await getCanonicalProgramService(req.payload.logger)
    await service.remove(doc.canonicalId, String(doc.slug ?? ''))
  } catch (error) {
    getCanonicalEventSink(req.payload.logger).emit({
      type: 'sync_failed',
      severity: 'error',
      slug: String(doc.slug ?? ''),
      error: (error as Error).message,
    })
  }

  return doc
}
