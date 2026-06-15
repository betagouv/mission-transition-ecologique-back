import { z } from 'zod'
import { nonEmptyStringSchema, sirenSchema } from './primitives'

/**
 * Opérateur (financeur / partenaire / contact).
 *
 * `nom_normalise` et `siren` sont optionnels au niveau canonical — ils ne sont
 * requis que pour l'export schéma de données (contrainte portée par la
 * projection correspondante, hors périmètre du paquet canonical).
 */
export const operateurSchema = z.object({
  nom: nonEmptyStringSchema,
  nom_normalise: nonEmptyStringSchema.optional(),
  siren: sirenSchema.optional(),
})
export type Operateur = z.infer<typeof operateurSchema>

/**
 * `contact` = opérateur à contacter (affiché en premier) ;
 * `autres` = co-financeurs / partenaires, distincts du contact.
 */
export const operateursSchema = z.object({
  contact: operateurSchema,
  autres: z.array(operateurSchema).optional(),
})
export type Operateurs = z.infer<typeof operateursSchema>
