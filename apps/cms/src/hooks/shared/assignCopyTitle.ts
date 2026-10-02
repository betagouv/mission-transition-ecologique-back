import type { FieldHook } from 'payload'

const COPY_SUFFIX = ' (copie)'

/**
 * `beforeDuplicate` hook of a `title` field: marks the copy in the list views,
 * where the original and its copy would otherwise share the same title.
 */
export const assignCopyTitle: FieldHook = ({ value }) => {
  if (typeof value !== 'string' || value.trim() === '' || value.endsWith(COPY_SUFFIX)) return value
  return `${value}${COPY_SUFFIX}`
}
