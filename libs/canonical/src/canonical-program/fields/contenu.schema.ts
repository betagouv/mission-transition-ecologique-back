import { z } from 'zod'
import { markdownSchema, nonEmptyStringSchema, urlSchema } from '../../shared/primitives'

/** SEO — affiché dans l'onglet navigateur / résultats de recherche. */
export const metaSchema = z.object({
  titre: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
})
export type Meta = z.infer<typeof metaSchema>

/**
 * Illustration du dispositif.
 * `alt` (texte alternatif) est optionnel : à défaut, le front dérive un libellé
 * depuis le titre — la dérivation est une préoccupation d'affichage, pas une
 * donnée du pivot.
 */
export const illustrationSchema = z.object({
  url: urlSchema,
  alt: nonEmptyStringSchema.optional(),
})
export type Illustration = z.infer<typeof illustrationSchema>

/** Section 2 — Contenu éditorial. */
export const contenuSchema = z.object({
  /** Titre commercial du dispositif. */
  titre: nonEmptyStringSchema,
  /** Résumé en une phrase, verbe à l'impératif (≤ 180 car.). */
  promesse: z.string().trim().min(1).max(180).optional(),
  /** Description courte, Markdown (≤ 5000 car.). */
  description: markdownSchema.min(1).max(5000),
  /** Complément facultatif, Markdown. */
  description_longue: markdownSchema.min(1).optional(),
  /** Illustration du dispositif (URL + texte alternatif optionnel). */
  illustration: illustrationSchema.optional(),
  meta: metaSchema.optional(),
})
