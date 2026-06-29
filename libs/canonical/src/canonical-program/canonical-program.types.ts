import type { z } from 'zod'
import type { canonicalProgramSchema } from './canonical-program.schema'

/** Validated output shape (`z.infer`): defaults applied, identifiers branded. */
export type CanonicalProgramData = z.infer<typeof canonicalProgramSchema>

/** Pre-validation input shape (`z.input`): plain-string ids, optional defaults — what DTO/ETL layers produce. */
export type CanonicalProgramInput = z.input<typeof canonicalProgramSchema>
