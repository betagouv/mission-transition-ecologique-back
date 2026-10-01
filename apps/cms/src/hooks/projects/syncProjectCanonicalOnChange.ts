import type { CollectionAfterChangeHook } from 'payload'
import { ProjectCanonicalMapper } from '@/services/canonical/ProjectCanonicalMapper'
import { ProjectCanonicalSyncPolicy } from '@/services/canonical/ProjectCanonicalSyncPolicy'
import { getCanonicalProjectService } from '@/services/canonical/canonicalProjectService'
import { getCanonicalEventSink } from '@/services/canonical/observability/canonicalEventSink'
import { getRichTextToMarkdown } from '@/services/canonical/rich-text/richTextToMarkdownProvider'
import type { Project } from '../../../payload-types'

/**
 * Mirrors a project into the canonical store after every save, as decided by
 * `ProjectCanonicalSyncPolicy`: a published project is written, a draft saved
 * over a published version leaves the canonical untouched, an unpublished one
 * is withdrawn. Outcomes (saved, removed, dropped, failed) are emitted as
 * events and never block the CMS write.
 */
export const syncProjectCanonicalOnChange: CollectionAfterChangeHook<Project> = async ({ doc, previousDoc, req }) => {
  try {
    const status = doc._status === 'published' ? 'published' : 'draft'
    // A draft saved over a published version only lands in the versions table:
    // the main row, read with `draft: false`, is still the published one.
    const main =
      status === 'published'
        ? doc
        : await req.payload.findByID({
            collection: 'projects',
            id: doc.id,
            draft: false,
            depth: 0,
            overrideAccess: true,
            req,
          })
    const action = ProjectCanonicalSyncPolicy.actionFor({
      status,
      publishedVersionLive: main._status === 'published',
    })
    if (action === 'keep') return doc

    const service = await getCanonicalProjectService(req.payload.logger)

    // A system write realigned the canonical id: drop the row stored under the
    // old one, which would otherwise keep the slug and reject the new row.
    const previousId = previousDoc?.canonicalId
    if (previousId && previousId !== doc.canonicalId) {
      await service.remove(previousId, String(previousDoc.slug ?? ''))
    }

    if (action === 'remove') {
      if (doc.canonicalId) await service.remove(doc.canonicalId, String(doc.slug ?? ''))
      return doc
    }

    // Re-fetch with relations populated so the mapper can resolve the image,
    // the programs and the linked projects. `req` keeps the read inside the
    // write transaction, where Postgres sees the new row.
    const full = await req.payload.findByID({
      collection: 'projects',
      id: doc.id,
      depth: 1,
      draft: false,
      overrideAccess: true,
      req,
    })

    const richText = await getRichTextToMarkdown(req.payload.config)
    // The service emits the saved/dropped event; we only handle hard failures here.
    await service.save(new ProjectCanonicalMapper(richText).map(full))
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
