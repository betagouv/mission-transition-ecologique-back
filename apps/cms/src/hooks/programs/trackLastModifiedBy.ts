import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Stamps `lastModifiedBy` with the acting user on every change.
 *
 * Payload does not natively record the author of a version, so this field is
 * captured into each version snapshot and read back by the custom versions
 * view to populate its "Qui" column for every version (not only workflow
 * transitions).
 */
export const trackLastModifiedBy: CollectionBeforeChangeHook = ({
  data,
  req,
}) => {
  if (req.user?.id) {
    data.lastModifiedBy = req.user.id
  }
  return data
}
