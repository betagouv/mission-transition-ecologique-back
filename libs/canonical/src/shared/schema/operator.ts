import { z } from 'zod'
import { nonEmptyStringSchema, sirenSchema } from '../primitives'

// Operator (funder / partner / contact). `nom_normalise` and `siren` are
// optional here; stricter projections enforce them when needed.
export const operateurSchema = z.object({
  nom: nonEmptyStringSchema,
  nom_normalise: nonEmptyStringSchema.optional(),
  siren: sirenSchema.optional(),
})
export type Operateur = z.infer<typeof operateurSchema>

// `contact` is the operator to reach first; `autres` are co-funders / partners.
export const operateursSchema = z.object({
  contact: operateurSchema,
  autres: z.array(operateurSchema).optional(),
})
export type Operateurs = z.infer<typeof operateursSchema>
