import type { z } from 'zod'
import type { agirProjetPivotSchema } from './agir-projet-pivot.schema'

/** Project pivot served by `GET /api/agir/projects/{slug}/pivot`. */
export type AgirProjetPivot = z.infer<typeof agirProjetPivotSchema>
