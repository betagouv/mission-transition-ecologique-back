import { z } from 'zod'
import {
  isoDateTimeSchema,
  legacySlugSchema,
  nafCodeSchema,
  nonEmptyStringSchema,
  projetDescriptionSchema,
  projetFaqSchema,
  projetPrioriteSchema,
  projetSeoSchema,
  refineKebabCaseSlug,
  slugSchema,
  urlSchema,
} from '@tee-backoffice/canonical'
import { ademeSourceSchema, ademeThemeSchema } from '../ademe-pivot.schema'

/**
 * Output guard for the AGIR project pivot = canonical project wire with the
 * AGIR deltas (slugs instead of canonical ids, single `statut`, lowercased
 * `source`, wire themes, absolute image URL). `.strict()` makes this a
 * WHITELIST: a canonical field added later and not listed here fails the guard
 * instead of leaking.
 *
 * ⚠️ Placeholder: AGIR has not specified the project format yet.
 */

export const agirProjetStatutSchema = z.enum(['en_prod', 'remplace'])

/** The canonical also accepts a rooted path and `mailto:`; AGIR only gets a followable link. */
export const agirProjetImageSchema = z
  .object({
    url: urlSchema.refine((url) => /^https?:\/\//i.test(url), { message: 'URL http(s) absolue attendue' }),
  })
  .strict()

export const agirProjetsLiesSchema = z
  .object({
    titre: nonEmptyStringSchema.optional(),
    description: nonEmptyStringSchema.optional(),
    /** Slugs of the linked projects (`valide` ones only). */
    projets: z.array(slugSchema),
  })
  .strict()

export const agirProjetPivotSchema = z
  .object({
    // Identity (id = slug, never the cuid2). A `remplace` tombstone keeps its
    // former, possibly non kebab-case, slug.
    id: legacySlugSchema,
    source: ademeSourceSchema,
    date_mise_a_jour: isoDateTimeSchema,

    // Lifecycle: a replaced project carries the slug of the current one.
    statut: agirProjetStatutSchema,
    remplace_par: legacySlugSchema.optional(),

    // Editorial content (unchanged from canonical, image aside).
    titre: nonEmptyStringSchema,
    nom_court: nonEmptyStringSchema,
    description_courte: nonEmptyStringSchema,
    image: agirProjetImageSchema.optional(),
    description_longue: projetDescriptionSchema,
    description_complementaire: projetDescriptionSchema.optional(),

    // Targeting (themes use the AGIR wire vocabulary).
    theme_principal: ademeThemeSchema,
    themes: z.array(ademeThemeSchema).optional(),
    secteurs: z.array(nafCodeSchema).optional(),
    priorite: projetPrioriteSchema.optional(),

    // References, as slugs. A replaced program keeps its former slug.
    dispositifs: z.array(legacySlugSchema).optional(),
    projets_lies: agirProjetsLiesSchema.optional(),

    faq: projetFaqSchema.optional(),
    seo: projetSeoSchema.optional(),
  })
  .strict()
  .superRefine(refineKebabCaseSlug('id', (data) => data['statut'] === 'remplace'))
