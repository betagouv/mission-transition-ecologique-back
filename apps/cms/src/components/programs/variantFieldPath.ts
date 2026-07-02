/**
 * Path helpers shared by the variant UI fields. Payload passes each custom field
 * a full form path (e.g. `variants.0.conditions.1.etConnector`); these derive the
 * sibling-row prefix and the row index from it, without any form-state access.
 */

/** Drops the last path segment, yielding the enclosing row/array prefix. */
export const parentFieldPath = (path: string): string => path.slice(0, path.lastIndexOf('.'))

/** Numeric index of the row owning a UI field (segment before the field name). */
export const rowIndexFromPath = (path: string): number => {
  const segments = path.split('.')
  return Number(segments[segments.length - 2])
}
