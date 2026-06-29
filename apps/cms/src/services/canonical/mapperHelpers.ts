import type { Operator } from '../../../payload-types'

/**
 * Trivial pure helpers shared by the canonical mapper. Kept as functions (not a
 * class) since they are stateless data transforms, per the project's "simple
 * pure helpers are acceptable" rule.
 */

/** Trimmed value or undefined when empty/missing. */
export function clean(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Payload date fields store full ISO timestamps; the pivot wants `YYYY-MM-DD`. */
export function toIsoDate(value: string | null | undefined): string | undefined {
  const cleaned = clean(value)
  return cleaned ? cleaned.slice(0, 10) : undefined
}

/** Operator display name from a (possibly unpopulated) relation. */
export function operatorName(operator: number | Operator | null | undefined): string | undefined {
  return operator && typeof operator === 'object' ? operator.name : undefined
}
