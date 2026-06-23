import type { CollectionBeforeChangeHook } from 'payload'
import { createId } from '@paralleldrive/cuid2'

/**
 * Stamps an immutable `canonicalId` (cuid2) whenever it is missing. This is the
 * stable identity carried into the canonical pivot format (`id`), which the auto-
 * increment Payload `id` cannot provide. Backfilling on update (not just create)
 * covers records predating the field, which would otherwise never sync. Only
 * filled when absent, never overwritten, so cross-references (e.g. `replacedBy`
 * → `remplace_par`) stay durable.
 */
export const assignCanonicalId: CollectionBeforeChangeHook = ({ data }) => {
  if (!data.canonicalId) {
    data.canonicalId = createId()
  }
  return data
}
