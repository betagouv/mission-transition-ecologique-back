import { z } from 'zod'
import { markdownSchema, nonEmptyStringSchema } from '../../shared/primitives'

/** SEO — affiché dans l'onglet navigateur / résultats de recherche. */
export const metaSchema = z.object({
  titre: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
})
export type Meta = z.infer<typeof metaSchema>

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
  meta: metaSchema.optional(),
})
