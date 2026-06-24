import { z } from 'zod'

/**
 * Tee output zod schema (iso `programs.json`). Deliberately permissive
 * (`.passthrough()`): the historical shape carries dynamic montant/durée keys
 * (« montant du financement »…) and has no strict contract. We mainly validate
 * the presence of the structural fields.
 */
export const teeProgramSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('tee'),
    titre: z.string().min(1),
    description: z.string().min(1),
    "nature de l'aide": z.string().min(1),
    promesse: z.string().optional(),
    'opérateur de contact': z.string().min(1),
  })
  .passthrough()
