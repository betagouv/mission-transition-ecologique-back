import type { CollectionBeforeChangeHook } from 'payload'
import { createId } from '@paralleldrive/cuid2'

/**
 * Stamps an immutable `canonicalId` (cuid2) on creation. This is the stable
 * identity carried into the canonical pivot format (`id`), which the auto-
 * increment Payload `id` cannot provide. Generated once and never overwritten,
 * so cross-references (e.g. `replacedBy` → `remplace_par`) stay durable.
 */
export const assignCanonicalId: CollectionBeforeChangeHook = ({
  data,
  operation,
}) => {
  if (operation === 'create' && !data.canonicalId) {
    data.canonicalId = createId()
  }
  return data
}
