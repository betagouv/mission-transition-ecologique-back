import type { CollectionBeforeChangeHook } from 'payload'
import { createId } from '@paralleldrive/cuid2'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'

/**
 * Stamps an immutable `canonicalId` (cuid2). This is the stable identity carried
 * into the canonical pivot format (`id`), which the auto-increment Payload `id`
 * cannot provide. For editors the existing value always wins, so the id never
 * changes once set (incoming edits are ignored even server-side); it is generated
 * only on create or to backfill a record predating the field, which would otherwise
 * never sync. Keeps cross-references (e.g. `replacedBy` → `remplace_par`) durable.
 *
 * A trusted system write (seed, upstream sync) may realign it on the id it
 * provides, derived from the slug: the daily canonical import uses that same id,
 * so both writers address the same canonical row instead of clashing on the slug.
 */
export const assignCanonicalId: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (SystemWorkflowContext.isActive(req.context) && data.canonicalId) return data
  data.canonicalId = originalDoc?.canonicalId || data.canonicalId || createId()
  return data
}
