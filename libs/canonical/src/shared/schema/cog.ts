import { z } from 'zod'
import { COG_PREFIXES } from '../cog'

// COG code = `LEVEL-code`. Loose by design: a known prefix + a non-empty
// alphanumeric body. Accepts irregular cases (DEP-2A, DEP-69M, EPCI-200046977,
// overseas codes). It does not check that a code exists nor its exact per-level
// format — existence is checked against the INSEE / GeographicAreas reference,
// keyed by the (level, code) pair.
const cogCodePattern = new RegExp(`^(${COG_PREFIXES.join('|')})-[0-9A-Z]+$`)

export const cogCodeSchema = z
  .string()
  .regex(cogCodePattern, 'code COG invalide (ex: REG-53, DEP-2A, OM-988)')
  .brand<'CogCode'>()
export type CogCode = z.infer<typeof cogCodeSchema>
