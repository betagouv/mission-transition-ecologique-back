import { z } from 'zod'
import { nonEmptyStringSchema } from '../../shared/primitives'

/**
 * Section 6 — Operator-specific extra data. A few known keys plus free keys;
 * `.passthrough()` keeps unknown keys through validation (lossless round-trip).
 */
export const additionalDataSchema = z
  .object({
    /** DSP id in the ADEME catalog. */
    ademe_id_dsp: nonEmptyStringSchema.optional(),
  })
  .passthrough()
export type AdditionalData = z.infer<typeof additionalDataSchema>
