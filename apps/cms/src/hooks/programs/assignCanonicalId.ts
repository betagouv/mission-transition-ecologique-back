import type { CollectionBeforeChangeHook } from 'payload'
import { createId } from '@paralleldrive/cuid2'

/**
 * Stamps an immutable `canonicalId` (cuid2). This is the stable identity carried
 * into the canonical pivot format (`id`), which the auto-increment Payload `id`
 * cannot provide. The existing value always wins, so the id never changes once
 * set (incoming edits are ignored even server-side); it is generated only on
 * create or to backfill a record predating the field, which would otherwise
 * never sync. Keeps cross-references (e.g. `replacedBy` → `remplace_par`) durable.
 */
export const assignCanonicalId: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  data.canonicalId = originalDoc?.canonicalId || data.canonicalId || createId()
  return data
}
