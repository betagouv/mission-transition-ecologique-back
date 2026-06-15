import { z } from 'zod'
import { cuid2Schema, isoDateTimeSchema, slugSchema } from '../../shared/primitives'
import { sourceSchema } from '../enums'

/** Section 1 — Identité. Champs à plat du dispositif. */
export const identiteSchema = z.object({
  /** Identifiant interne CUID2 (généré en amont, simplement validé ici). */
  id: cuid2Schema,
  /** Identifiant lisible unique (URLs). Ancien `id` de `programs.json`. */
  slug: slugSchema,
  source: sourceSchema,
  /** Dernière modification réelle du contenu (pas la date d'export). */
  date_mise_a_jour: isoDateTimeSchema,
})
