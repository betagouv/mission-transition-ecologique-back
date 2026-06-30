import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Stamps a review comment with its author on creation. `author` is read-only in
 * the API/UI, so only a server-side write fills it from the authenticated user.
 */
export const assignCommentAuthor: CollectionBeforeChangeHook = ({
  data,
  req,
  operation,
}) => {
  if (operation === 'create' && req.user) {
    data.author = req.user.id
  }
  return data
}
