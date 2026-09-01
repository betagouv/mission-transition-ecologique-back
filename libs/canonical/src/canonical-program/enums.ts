import { z } from 'zod'

// Closed vocabularies of the canonical (pivot) format. Single source of truth —
// every schema and projection reads from here.

/** Source of the program. */
export const sourceSchema = z.enum(['ADEME', 'INTERNE', 'SCHEMA'])
export type Source = z.infer<typeof sourceSchema>

/** Editorial status — content authoring progress. Orthogonal to `statutDispositifSchema`. */
export const statutEditionSchema = z.enum([
  'inconnu',
  'en_creation',
  'en_reecriture',
  'pret_prod',
  'archive',
  'abandonne', // abandoned before publication
])
export type StatutEdition = z.infer<typeof statutEditionSchema>

/** Program status — real validity of the aid. `remplace` requires `remplace_par`. */
export const statutDispositifSchema = z.enum([
  'inconnu',
  'valide',
  'temporairement_indisponible',
  'remplace',
  'archive',
])
export type StatutDispositif = z.infer<typeof statutDispositifSchema>

/** Aid nature — the 8 types of the interministerial data schema. */
export const typeAideSchema = z.enum([
  'assistance',
  'avantage_fiscal',
  'conseil',
  'etude',
  'financement',
  'formation',
  'information',
  'pret',
])
export type TypeAide = z.infer<typeof typeAideSchema>

/** Thematic targeting — internal taxonomy (V0, French labels). */
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

/** Contact channel for questions. */
export const contactQuestionTypeSchema = z.enum(['conseiller_entreprise', 'email', 'url'])
export type ContactQuestionType = z.infer<typeof contactQuestionTypeSchema>

/** Legal company category — closed vocabulary (V0). Used by `eligibilite.categorie_legale`. */
export const categorieLegaleSchema = z.enum(['micro_entrepreneur'])
export type CategorieLegale = z.infer<typeof categorieLegaleSchema>
