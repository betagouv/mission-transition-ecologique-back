import { z } from 'zod'

/**
 * Schéma zod de sortie **Tee** (iso `programs.json`). Volontairement **permissif**
 * (`.passthrough()`) : la forme historique porte des clés dynamiques de montant/
 * durée (« montant du financement »…) et n'a pas de contrat strict. On valide
 * surtout la présence des champs structurants.
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
