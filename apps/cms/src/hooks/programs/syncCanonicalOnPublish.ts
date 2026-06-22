import type { CollectionAfterChangeHook } from 'payload'
import { ProgramCanonicalMapper } from '@/services/canonical/ProgramCanonicalMapper'
import { PayloadRichTextToMarkdown } from '@/services/canonical/rich-text/PayloadRichTextToMarkdown'
import { getCanonicalProgramService } from '@/services/canonical/canonicalProgramService'
import type { Program } from '../../../payload-types'

/**
 * Mirrors a published program into the canonical store after every save. The
 * canonical is the durable source of truth, so it is kept in sync on publish.
 * Only published programs are persisted; drafts are out of scope. Failures are
 * logged and never block the CMS write.
 */
export const syncCanonicalOnPublish: CollectionAfterChangeHook<Program> = async ({ doc, req }) => {
  if (doc._status !== 'published') return doc

  try {
    // Re-fetch with relations populated so the mapper can resolve operators,
    // geographic areas and the replacing program.
    const full = await req.payload.findByID({
      collection: 'programs',
      id: doc.id,
      depth: 1,
      overrideAccess: true,
    })

    const markdown = await PayloadRichTextToMarkdown.create(req.payload.config)
    const input = new ProgramCanonicalMapper(markdown).map(full)
    const result = await (await getCanonicalProgramService()).save(input)

    if (result.status === 'invalid') {
      req.payload.logger.warn(`canonical sync skipped for "${doc.slug}": invalid canonical`)
    }
  } catch (error) {
    req.payload.logger.error(`canonical sync failed for "${doc.slug}": ${(error as Error).message}`)
  }

  return doc
}
