import { z } from 'zod'

/**
 * Shared, reusable building blocks for the canonical (pivot) format.
 *
 * Branded primitives give nominal typing: a `Siren` cannot be passed where a
 * `CogCode` is expected, even though both are strings at runtime. Branding is
 * produced by parsing — consumers obtain branded values out of the validator,
 * they never construct them by hand.
 */

/** Non-empty, trimmed string. */
export const nonEmptyStringSchema = z.string().trim().min(1)

/** Markdown content. Free text; length constraints are applied per field. */
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

/** Date seule ISO 8601 (`2025-12-31`). */
export const isoDateSchema = z.string().date()

/** Date-heure ISO 8601 avec offset (`2026-03-19T17:00:00+01:00`). */
export const isoDateTimeSchema = z.string().datetime({ offset: true })

/** Date seule OU date-heure (utilisé par `date_cloture`). */
export const isoDateOrDateTimeSchema = z.union([isoDateSchema, isoDateTimeSchema])

/** SIREN — 9 chiffres. */
export const sirenSchema = z
  .string()
  .regex(/^\d{9}$/, 'SIREN invalide (9 chiffres attendus)')
  .brand<'Siren'>()
export type Siren = z.infer<typeof sirenSchema>

/**
 * Code COG (Code Officiel Géographique) préfixé par son niveau :
 * `PAYS-99100`, `REG-53`, `DEP-04`, `COM-988`, `EPCI-200000172`.
 */
export const cogCodeSchema = z
  .string()
  .regex(/^(PAYS|REG|DEP|COM|EPCI)-[0-9A-Z]+$/, 'code COG invalide (ex: REG-53)')
  .brand<'CogCode'>()
export type CogCode = z.infer<typeof cogCodeSchema>

/** Code COG restreint au niveau région (`REG-53`) — utilisé par les conditions de variante. */
export const regionCogCodeSchema = z
  .string()
  .regex(/^REG-[0-9A-Z]+$/, 'code région COG attendu (ex: REG-53)')
  .brand<'CogCode'>()
export type RegionCogCode = z.infer<typeof regionCogCodeSchema>

/**
 * Code NAF/APE. Accepte une section (`A`), une division (`01`), un groupe
 * (`01.1`) ou une classe/sous-classe (`01.11Z`). Volontairement permissif —
 * à resserrer si la granularité retenue se précise.
 */
export const nafCodeSchema = z
  .string()
  .regex(/^([A-U]|\d{2}(\.\d{1,2}[A-Z]?)?)$/, 'code NAF invalide (ex: 01.11Z ou A)')
  .brand<'NafCode'>()
export type NafCode = z.infer<typeof nafCodeSchema>

/** URL absolue. */
export const urlSchema = z.string().url()

/**
 * Intervalle numérique à bornes incluses (effectif salarié). Bornes
 * optionnelles : `{ min: 3 }` = « à partir de 3 », `{ max: 49 }` = « jusqu'à 49 ».
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
