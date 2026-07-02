import type { CollectionBeforeValidateHook } from 'payload'
import { Forbidden } from 'payload'

/**
 * Stamps a review comment with its author on creation from the authenticated
 * user, ignoring any client-provided value. `author` is read-only in the API/UI
 * and required, so this runs in beforeValidate (before the required check) and
 * enforces req.user so a comment can never be persisted without an author.
 */
export const assignCommentAuthor: CollectionBeforeValidateHook = ({
  data,
  req,
  operation,
}) => {
  if (operation !== 'create') return data
  if (!req.user) throw new Forbidden(req.t)
  return { ...data, author: req.user.id }
}
