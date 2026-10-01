import type { CollectionSlug, FieldHook } from 'payload'
import { CopySlug } from '@/utils/CopySlug'

/**
 * `beforeDuplicate` hook of a unique `slug` field: gives the copy a kebab-case
 * slug that no document holds yet, so duplicating the same original twice does
 * not fail on the unique constraint.
 */
export const assignCopySlug: FieldHook = async ({ value, collection, req }) => {
  if (typeof value !== 'string' || value.trim() === '' || !collection) return value

  // The main table is the one that carries the unique constraint.
  const { docs } = await req.payload.find({
    collection: collection.slug as CollectionSlug,
    where: { slug: { in: CopySlug.candidates(value) } },
    select: { slug: true },
    depth: 0,
    pagination: false,
    req,
  })

  return CopySlug.firstFree(
    value,
    docs.map((doc) => String((doc as { slug?: unknown }).slug)),
  )
}
