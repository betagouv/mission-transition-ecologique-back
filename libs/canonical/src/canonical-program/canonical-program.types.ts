import type { z } from 'zod'
import type { canonicalProgramSchema } from './canonical-program.schema'

/**
 * Validated output shape of a canonical program (`z.infer`).
 * Defaults applied, identifiers branded (`Cuid2`, `Siren`, `CogCode`…).
 * This is what you get *out* of the validator and read from a `CanonicalProgram`.
 */
export type CanonicalProgramData = z.infer<typeof canonicalProgramSchema>

/**
 * Pre-validation input shape (`z.input`). Identifiers are plain strings and
 * defaulted fields are optional. This is the type DTO / ETL layers (CMS → pivot,
 * schéma → pivot) should produce, then hand to `CanonicalProgramValidator`.
 */
export type CanonicalProgramInput = z.input<typeof canonicalProgramSchema>
