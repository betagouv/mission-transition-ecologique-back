import { z } from 'zod'

/**
 * Code of an ADEME theme, from the ADEME referential published upstream
 * (`ademe_themes.json`): a two-digit root (`19`) or a root and a sub-theme
 * (`19_03`). Labels are not part of the pivot, consumers resolve them from the
 * referential.
 */
export const ademeThemeCodeSchema = z.string().regex(/^\d{2}(_\d{2})?$/, {
  message: 'Code de thématique ADEME invalide (attendu : "19" ou "19_03")',
})
export type AdemeThemeCode = z.infer<typeof ademeThemeCodeSchema>
