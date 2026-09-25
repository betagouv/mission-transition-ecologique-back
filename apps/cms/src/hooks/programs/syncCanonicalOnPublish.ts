import type { CollectionAfterChangeHook } from 'payload'
import { CanonicalSyncPolicy } from '@/services/canonical/CanonicalSyncPolicy'
import { ProgramCanonicalMapper } from '@/services/canonical/ProgramCanonicalMapper'
import { getRichTextToMarkdown } from '@/services/canonical/rich-text/richTextToMarkdownProvider'
import { getCanonicalProgramService } from '@/services/canonical/canonicalProgramService'
import { getCanonicalEventSink } from '@/services/canonical/observability/canonicalEventSink'
import type { Program } from '../../../payload-types'

/**
 * Mirrors a program into the canonical store after every save, as decided by
 * `CanonicalSyncPolicy`: published, archived and replaced programs are written,
 * cancelled ones are withdrawn, in-progress ones leave the canonical untouched.
 * Outcomes (saved, removed, dropped, failed) are emitted as events and never
 * block the CMS write.
 */
export const syncCanonicalOnPublish: CollectionAfterChangeHook<Program> = async ({ doc, req }) => {
  const action = CanonicalSyncPolicy.actionFor(doc.workflowStatus ?? 'en-creation')
  if (action === 'keep') return doc

  try {
    const service = await getCanonicalProgramService(req.payload.logger)

    if (action === 'remove') {
      if (doc.canonicalId) await service.remove(doc.canonicalId, String(doc.slug ?? ''))
      return doc
    }

    // Re-fetch with relations populated so the mapper can resolve operators,
    // geographic areas and the replacing program. `draft: true` reads the latest
    // version: archiving and replacing save the program as a draft. `req` keeps
    // the read inside the write transaction, where Postgres sees the new row.
    const full = await req.payload.findByID({
      collection: 'programs',
      id: doc.id,
      depth: 1,
      draft: true,
      overrideAccess: true,
      req,
    })

    const markdown = await getRichTextToMarkdown(req.payload.config)
    // The service emits the saved/dropped event; we only handle hard failures here.
    await service.save(new ProgramCanonicalMapper(markdown).map(full))
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
