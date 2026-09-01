import { z } from 'zod'
import {
  contactQuestionSchema,
  dureeSchema,
  eligibiliteSchema,
  etapeActivationSchema,
  illustrationSchema,
  isoDateOrDateTimeSchema,
  isoDateSchema,
  isoDateTimeSchema,
  markdownSchema,
  metaSchema,
  montantSchema,
  nonEmptyStringSchema,
  operateursSchema,
  slugSchema,
  typeAideSchema,
  urlSchema,
  varianteSchema,
} from '@tee-backoffice/canonical'

/**
 * Output guard for the ADEME pivot (proposition 2) = canonical wire with the
 * ADEME deltas (see README §Décisions). `.strict()` makes this a WHITELIST: any
 * canonical field added later that is not listed here fails the guard instead of
 * leaking. Field shapes are reused from the canonical so the pivot stays iso,
 * except the closed vocabularies (`source`, `statut`, `themes`) which use the
 * lowercased/snake_case AGIR wire values.
 */

export const ademeSourceSchema = z.enum(['tee', 'ademe', 'schema'])
export const ademeStatutSchema = z.enum(['en_prod', 'temporairement_indisponible', 'remplace'])
export const ademeThemeSchema = z.enum([
  'batiment',
  'mobilite',
  'dechets',
  'eau',
  'energie',
  'rh',
  'environnement',
])

/** Contact question: identical to the canonical shape (no ADEME-specific vocabulary). */
export const ademeContactQuestionSchema = contactQuestionSchema
export type AgirContactQuestion = z.infer<typeof ademeContactQuestionSchema>

export const ademePivotSchema = z
  .object({
    // Identity (id = slug, never the cuid2; ademe_id_dsp surfaced if present).
    id: slugSchema,
    ademe_id_dsp: nonEmptyStringSchema.optional(),
    source: ademeSourceSchema,
    date_mise_a_jour: isoDateTimeSchema,

    // Editorial content (unchanged from canonical).
    titre: nonEmptyStringSchema,
    promesse: z.string().optional(),
    description: markdownSchema,
    description_longue: markdownSchema.optional(),
    illustration: illustrationSchema.optional(),
    meta: metaSchema.optional(),

    // Lifecycle (single collapsed statut; statut_edition/statut_dispositif dropped).
    // Archived aids ship as en_prod carried by date_cloture; replaced aids carry
    // remplace_par as the replacing program's slug.
    statut: ademeStatutSchema,
    date_ouverture: isoDateSchema.optional(),
    date_cloture: isoDateOrDateTimeSchema.optional(),
    remplace_par: slugSchema.optional(),

    // Aid nature (montant/duree kept as objects).
    types_aides: z.array(typeAideSchema).min(1),
    montant: montantSchema.optional(),
    duree: dureeSchema.optional(),

    // Actors and contact (canonical shapes kept).
    operateurs: operateursSchema,
    contact_question: ademeContactQuestionSchema.optional(),
    url_source: urlSchema.optional(),
    etapes_activation: z.array(etapeActivationSchema).optional(),

    // Eligibility / themes / variants (canonical shapes kept; themes use wire vocab).
    eligibilite: eligibiliteSchema.optional(),
    themes: z.array(ademeThemeSchema).optional(),
    variantes: z.array(varianteSchema).optional(),
  })
  .strict()
