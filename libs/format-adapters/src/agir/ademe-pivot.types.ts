import type { z } from 'zod'
import type { ademePivotSchema } from './ademe-pivot.schema'

/** ADEME pivot served by `GET /api/agir/programs/{slug}/pivot` (proposition 2). */
export type AdemePivot = z.infer<typeof ademePivotSchema>
