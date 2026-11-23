import { ademeThemeCodeSchema } from '@tee-backoffice/canonical'
import { z } from 'zod'

/**
 * One entry of upstream `ademe_themes.json`, the ADEME theme referential
 * generated from Baserow: a flat list of roots (`parentCode: null`) and their
 * sub-themes. Programs cite these codes in `ademeThemes`.
 */
export const teeAdemeThemeSchema = z.object({
  code: ademeThemeCodeSchema,
  parentCode: ademeThemeCodeSchema.nullable(),
  label: z.string().min(1),
})

export const teeAdemeThemesSchema = z.array(teeAdemeThemeSchema)

export type TeeAdemeTheme = z.infer<typeof teeAdemeThemeSchema>
