import { z } from 'zod'
import { categorieLegaleSchema } from '../enums'
import { cogCodeSchema } from '../../shared/schema/cog'
import {
  intervalleSchema,
  nafCodeSchema,
  nonEmptyStringSchema,
} from '../../shared/primitives'

/**
 * Section 4 — Eligibility. One `eligibilite` object, one sub-object per
 * criterion. Each carries an editorial `texte` (displayed bullets) and, when it
 * exists, a `structure` version (source of truth for eligibility computation).
 * Purely editorial criteria (`anciennete`, `autres_criteres`) have no structure.
 * Everything is optional here; stricter constraints live in the projections.
 */

/** Editorial eligibility conditions (one bullet per item). */
const texteSchema = z.array(nonEmptyStringSchema)

/** `{ inclusions, exclusions? }` — exclusions take precedence over inclusions. */
const nafCiblageSchema = z.object({
  inclusions: z.array(nafCodeSchema),
  exclusions: z.array(nafCodeSchema).optional(),
})

const cogCiblageSchema = z.object({
  inclusions: z.array(cogCodeSchema),
  exclusions: z.array(cogCodeSchema).optional(),
})

/** A legal category: a closed-vocabulary value or free text (not yet in the enum). */
const categorieLegaleItemSchema = z.union([categorieLegaleSchema, nonEmptyStringSchema])

export const eligibiliteSchema = z.object({
  /** Headcount — a single interval `{ min?, max? }` (bounds included). */
  effectif: z
    .object({
      texte: texteSchema.optional(),
      structure: intervalleSchema.optional(),
    })
    .optional(),

  /** Legal category — allowed / forbidden lists (closed-vocabulary value or free text). */
  categorie_legale: z
    .object({
      texte: texteSchema.optional(),
      structure: z
        .object({
          autorise: z.array(categorieLegaleItemSchema).optional(),
          interdit: z.array(categorieLegaleItemSchema).optional(),
        })
        .optional(),
    })
    .optional(),

  /** Business sector — NAF codes. */
  secteur_activite: z
    .object({
      texte: texteSchema.optional(),
      structure: nafCiblageSchema.optional(),
    })
    .optional(),

  /** Geographic area — COG codes. */
  secteur_geographique: z
    .object({
      texte: texteSchema.optional(),
      structure: cogCiblageSchema.optional(),
    })
    .optional(),

  /** Seniority — editorial only. */
  anciennete: z.object({ texte: texteSchema.optional() }).optional(),

  /** Other criteria — editorial only. */
  autres_criteres: z.object({ texte: texteSchema.optional() }).optional(),
})
export type Eligibilite = z.infer<typeof eligibiliteSchema>
