import { z } from 'zod'
import { markdownSchema, nonEmptyStringSchema, urlSchema } from '../../shared/primitives'

/** SEO — shown in the browser tab / search results. */
export const metaSchema = z.object({
  titre: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
})
export type Meta = z.infer<typeof metaSchema>

/** Illustration. `alt` is optional; the front derives a label from the title otherwise. */
export const illustrationSchema = z.object({
  url: urlSchema,
  alt: nonEmptyStringSchema.optional(),
})
export type Illustration = z.infer<typeof illustrationSchema>

/** Section 2 — Editorial content. */
export const contenuSchema = z.object({
  /** Commercial title. */
  titre: nonEmptyStringSchema,
  /** One-sentence summary, imperative verb (≤ 180 chars). */
  promesse: z.string().trim().min(1).max(180).optional(),
  /** Short description, Markdown (≤ 5000 chars). */
  description: markdownSchema.min(1).max(5000),
  /** Optional long-form complement, Markdown. */
  description_longue: markdownSchema.min(1).optional(),
  /** Illustration (URL + optional alt text). */
  illustration: illustrationSchema.optional(),
  meta: metaSchema.optional(),
})
