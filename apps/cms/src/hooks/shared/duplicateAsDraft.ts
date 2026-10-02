import type { CollectionBeforeOperationHook } from 'payload'

/**
 * Forces a duplicated document to be saved as a draft, whatever the caller
 * asked for. Payload fills the copy with the values of the original, `_status`
 * included: without the `draft` flag, the copy of a published document would be
 * published at once (the admin sends the flag, the Local API does not by
 * default). Saving as a draft also skips validation, so a copy is never refused
 * because of a value inherited from the original.
 */
export const duplicateAsDraft: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation !== 'create') return args
  const { duplicateFromID } = args as { duplicateFromID?: number | string | null }
  return duplicateFromID == null ? args : { ...args, draft: true }
}
