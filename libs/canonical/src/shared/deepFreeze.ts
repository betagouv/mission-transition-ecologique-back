/**
 * Recursively freezes an object graph in place and returns it.
 *
 * Used by {@link CanonicalProgram} to make a validated program deeply immutable.
 * Safe on zod output: `parse` returns a fresh object, so freezing never affects
 * anything upstream. Reads, `JSON.stringify` and `structuredClone` all keep
 * working on a frozen graph.
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key])
    }
  }
  return value
}
