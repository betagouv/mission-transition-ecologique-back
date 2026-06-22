import { z } from 'zod'

/**
 * Shared building blocks for the canonical (pivot) format. Branded primitives
 * give nominal typing (a `Siren` is not a `CogCode`, though both are strings).
 * Brands are produced by parsing — consumers never construct them by hand.
 */

/** Non-empty, trimmed string. */
export const nonEmptyStringSchema = z.string().trim().min(1)

/** Markdown content. Free text; length constraints applied per field. */
export const markdownSchema = z.string()

/** CUID2 identifier — generated upstream, only validated here. */
export const cuid2Schema = z.string().cuid2().brand<'Cuid2'>()
export type Cuid2 = z.infer<typeof cuid2Schema>

/** URL-readable identifier, e.g. `aide-decarbonation-industrie`. */
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug invalide (kebab-case attendu)')
  .brand<'Slug'>()
export type Slug = z.infer<typeof slugSchema>

/** ISO 8601 date (`2025-12-31`). */
export const isoDateSchema = z.string().date()

/** ISO 8601 date-time with offset (`2026-03-19T17:00:00+01:00`). */
export const isoDateTimeSchema = z.string().datetime({ offset: true })

/** Date or date-time (used by `date_cloture`). */
export const isoDateOrDateTimeSchema = z.union([isoDateSchema, isoDateTimeSchema])

/** SIREN — 9 digits. */
export const sirenSchema = z
  .string()
  .regex(/^\d{9}$/, 'SIREN invalide (9 chiffres attendus)')
  .brand<'Siren'>()
export type Siren = z.infer<typeof sirenSchema>

/**
 * NAF/APE code. Accepts a section (`A`), division (`01`), group (`01.1`) or
 * class/subclass (`01.11Z`). Deliberately permissive — tighten if the chosen
 * granularity firms up.
 */
export const nafCodeSchema = z
  .string()
  .regex(/^([A-U]|\d{2}(\.\d{1,2}[A-Z]?)?)$/, 'code NAF invalide (ex: 01.11Z ou A)')
  .brand<'NafCode'>()
export type NafCode = z.infer<typeof nafCodeSchema>

/** Absolute URL. */
export const urlSchema = z.string().url()

/**
 * Numeric interval, bounds included (headcount). Bounds optional: `{ min: 3 }`
 * = "from 3", `{ max: 49 }` = "up to 49".
 */
export const intervalleSchema = z
  .object({
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().nonnegative().optional(),
  })
  .refine((i) => i.min !== undefined || i.max !== undefined, {
    message: 'au moins une borne (min ou max) est requise',
  })
  .refine((i) => i.min === undefined || i.max === undefined || i.min <= i.max, {
    message: 'min doit être inférieur ou égal à max',
  })
export type Intervalle = z.infer<typeof intervalleSchema>
