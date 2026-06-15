import { z } from 'zod'
import {
  intervalleSchema,
  nonEmptyStringSchema,
  regionCogCodeSchema,
  urlSchema,
} from '../../shared/primitives'
import { operateursSchema } from '../../shared/operateur.schema'
import { eligibiliteSchema } from '../fields/eligibilite.schema'

/**
 * Section 5 — Variantes (ex « champs conditionnels »).
 *
 * Chaque variante porte une condition structurée et des modifications qui
 * surchargent les champs du cas général (remplacement clé par clé).
 */

/** Conjonction (ET) d'un intervalle d'effectif et/ou d'une liste de régions (OU). */
export const varianteConditionsSchema = z
  .object({
    effectif: intervalleSchema.optional(),
    regions: z.array(regionCogCodeSchema).min(1).optional(),
  })
  .refine((c) => c.effectif !== undefined || c.regions !== undefined, {
    message: 'une variante doit porter au moins une condition (effectif ou regions)',
  })

/** Sous-ensemble des champs du cas général que la variante peut surcharger. */
export const varianteModificationsSchema = z
  .object({
    montant: nonEmptyStringSchema,
    duree: nonEmptyStringSchema,
    url_source: urlSchema,
    operateurs: operateursSchema,
    eligibilite: eligibiliteSchema,
  })
  .partial()
  .refine((m) => Object.values(m).some((v) => v !== undefined), {
    message: 'une variante doit porter au moins une modification',
  })

export const varianteSchema = z.object({
  conditions: varianteConditionsSchema,
  modifications: varianteModificationsSchema,
  /** Champs libres propres à la variante (ex. `titre_historique`). */
  autres_champs: z.record(z.unknown()).optional(),
})
export type Variante = z.infer<typeof varianteSchema>
