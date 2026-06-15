import { z } from 'zod'
import {
  cogCodeSchema,
  intervalleSchema,
  nafCodeSchema,
  nonEmptyStringSchema,
} from '../../shared/primitives'

/**
 * Section 4 — Éligibilité (forme refacto).
 *
 * Un seul objet `eligibilite`, un sous-objet par critère. Chaque critère porte
 * sa version éditoriale `texte` (puces affichées) et, quand elle existe, sa
 * version `structure` (source de vérité pour le calcul d'éligibilité).
 * Les critères purement rédactionnels (`anciennete`, `autres_criteres`) n'ont
 * pas de version structurée.
 *
 * Tout est optionnel au niveau canonical : un dispositif en création peut ne
 * pas encore porter son éligibilité. Les contraintes plus strictes seront
 * portées par les projections (hors périmètre du paquet canonical).
 */

/** Conditions d'éligibilité rédigées (une puce par item). */
const texteSchema = z.array(nonEmptyStringSchema)

/** `{ inclusions, exclusions? }` — exclusions prioritaires sur inclusions. */
const nafCiblageSchema = z.object({
  inclusions: z.array(nafCodeSchema),
  exclusions: z.array(nafCodeSchema).optional(),
})

const cogCiblageSchema = z.object({
  inclusions: z.array(cogCodeSchema),
  exclusions: z.array(cogCodeSchema).optional(),
})

export const eligibiliteSchema = z.object({
  /** Effectif salarié — union d'intervalles (bornes incluses). */
  effectif: z
    .object({
      texte: texteSchema.optional(),
      structure: z.object({ intervalles: z.array(intervalleSchema) }).optional(),
    })
    .optional(),

  /** Catégorie légale (porte l'exclusion micro-entrepreneur). */
  categorie_legale: z
    .object({
      texte: texteSchema.optional(),
      structure: z.object({ microentrepreneur_exclu: z.boolean().default(false) }).optional(),
    })
    .optional(),

  /** Secteur d'activité — codes NAF. */
  secteur_activite: z
    .object({
      texte: texteSchema.optional(),
      structure: nafCiblageSchema.optional(),
    })
    .optional(),

  /** Secteur géographique — codes COG. */
  secteur_geographique: z
    .object({
      texte: texteSchema.optional(),
      structure: cogCiblageSchema.optional(),
    })
    .optional(),

  /** Ancienneté — rédactionnel uniquement. */
  anciennete: z.object({ texte: texteSchema.optional() }).optional(),

  /** Autres critères — rédactionnel uniquement. */
  autres_criteres: z.object({ texte: texteSchema.optional() }).optional(),
})
export type Eligibilite = z.infer<typeof eligibiliteSchema>
