import type { z } from 'zod'
import type { canonicalProjectSchema } from './canonical-project.schema'

/** Validated output shape (`z.infer`): identifiers branded. */
export type CanonicalProjectData = z.infer<typeof canonicalProjectSchema>

/** Pre-validation input shape (`z.input`): plain-string ids, what mappers and importers produce. */
export type CanonicalProjectInput = z.input<typeof canonicalProjectSchema>
