import { z } from 'zod'
import { emptyAsAbsent } from './emptyAsAbsent'

/**
 * One entry of upstream `operators.json`, generated from the Baserow operators
 * table. `filterCategories` are the operator groups (many-to-many); `imagePath`
 * is the logo path under the upstream front's public folder.
 */
export const teeOperatorSchema = z
  .object({
    operator: z.string().min(1),
    filterCategories: z.preprocess(emptyAsAbsent, z.array(z.string().min(1)).default([])),
    imagePath: z.preprocess(emptyAsAbsent, z.string().min(1).optional()),
    color: z.string().optional(),
  })

export const teeOperatorsSchema = z.array(teeOperatorSchema)

export type TeeOperator = z.infer<typeof teeOperatorSchema>
