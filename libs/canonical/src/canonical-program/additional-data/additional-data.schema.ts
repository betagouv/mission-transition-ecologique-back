import { z } from 'zod'
import { nonEmptyStringSchema } from '../../shared/primitives'

/**
 * Section 6 — Autres données spécifiques à un opérateur.
 *
 * Quelques clés connues + clés libres. `.passthrough()` garantit que les clés
 * inconnues survivent à la validation (round-trip sans perte).
 */
export const additionalDataSchema = z
  .object({
    /** Identifiant DSP du catalogue ADEME. */
    ademe_id_dsp: nonEmptyStringSchema.optional(),
  })
  .passthrough()
export type AdditionalData = z.infer<typeof additionalDataSchema>
