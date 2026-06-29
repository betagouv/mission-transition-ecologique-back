import { z } from 'zod'
import { cogCodeSchema } from '../../shared/schema/cog'
import { intervalleSchema, urlSchema } from '../../shared/primitives'
import { operateursSchema } from '../../shared/schema/operator'
import { dureeSchema, montantSchema } from '../fields/aide.schema'
import { eligibiliteSchema } from '../fields/eligibilite.schema'

/**
 * Section 5 — Variants (former "conditional fields"). Each variant has a
 * structured condition and modifications that override the base fields key by key.
 */

/**
 * AND of a headcount interval and/or a list of geographic areas (OR). Areas
 * accept any COG level — variants are not limited to the région level.
 */
export const varianteConditionsSchema = z
  .object({
    effectif: intervalleSchema.optional(),
    regions: z.array(cogCodeSchema).min(1).optional(),
  })
  .refine((c) => c.effectif !== undefined || c.regions !== undefined, {
    message: 'une variante doit porter au moins une condition (effectif ou regions)',
  })

/** Subset of base fields a variant may override. */
export const varianteModificationsSchema = z
  .object({
    montant: montantSchema,
    duree: dureeSchema,
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
  /** Free-form fields specific to the variant (e.g. `titre_historique`). */
  autres_champs: z.record(z.unknown()).optional(),
})
export type Variante = z.infer<typeof varianteSchema>
