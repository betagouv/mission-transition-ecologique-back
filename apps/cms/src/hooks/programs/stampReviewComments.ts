import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Stamps newly added review comments with their author (the current user) and
 * creation date. `author`/`date` are read-only in the UI, so a brand-new
 * comment row reaches the hook without them: only those rows are filled in,
 * which leaves existing comments' authorship and timestamps untouched.
 */
export const stampReviewComments: CollectionBeforeChangeHook = ({ data, req }) => {
  const comments = data.reviewComments
  if (!Array.isArray(comments) || comments.length === 0) return data

  const authorId = req.user?.id ?? null
  const now = new Date().toISOString()

  data.reviewComments = comments.map((comment) =>
    comment && typeof comment === 'object' && !comment.author
      ? { ...comment, author: authorId, date: now }
      : comment,
  )

  return data
}
