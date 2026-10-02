import { z } from 'zod'

/** Thematic targeting: internal taxonomy (V0, French labels), shared by programs and projects. */
export const themeSchema = z.enum([
  'batiment',
  'mobilite',
  'dechets',
  'eau',
  'energie',
  'rh',
  'environnemental',
  'ecoconception',
  'biodiversite',
])
export type Theme = z.infer<typeof themeSchema>
