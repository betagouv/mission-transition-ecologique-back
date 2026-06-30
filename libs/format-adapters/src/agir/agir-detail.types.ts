import type { z } from 'zod'
import type { agirDetailSchema } from './agir-detail.schema'

/** Detail view served by `GET /api/agir/programs/{slug}/detail` (proposition 1, R2DA). */
export type DetailDispositif = z.infer<typeof agirDetailSchema>
