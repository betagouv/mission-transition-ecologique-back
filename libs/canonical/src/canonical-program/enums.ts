import { z } from 'zod'

/**
 * Closed vocabularies of the canonical (pivot) format.
 * Single source of truth — every schema and projection reads from here.
 */

/** Provenance du dispositif. */
export const sourceSchema = z.enum(['ADEME', 'INTERNE', 'SCHEMA'])
export type Source = z.infer<typeof sourceSchema>

/**
 * Statut d'édition — où en est la rédaction du contenu.
 * Axe orthogonal à `statutDispositifSchema`.
 */
export const statutEditionSchema = z.enum([
  'inconnu',
  'en_creation',
  'en_reecriture',
  'pret_prod',
  'archive',
  'abandonne', // abandonné avant publication
])
export type StatutEdition = z.infer<typeof statutEditionSchema>

/**
 * Statut du dispositif — validité réelle de l'aide.
 * `remplace` impose `remplace_par` (voir refine du cas général).
 */
export const statutDispositifSchema = z.enum([
  'inconnu',
  'valide',
  'temporairement_indisponible',
  'remplace',
  'archive',
])
export type StatutDispositif = z.infer<typeof statutDispositifSchema>

/**
 * Nature de l'aide — les 8 types du schéma de données interministériel,
 * qui couvrent les 5 types d'aides actuels du projet.
 */
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

/** Ciblage thématique — taxonomie interne (V0, libellés français). */
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

/** Canal de contact pour les questions. */
export const contactQuestionTypeSchema = z.enum(['ADEME', 'conseiller_entreprise', 'email', 'url'])
export type ContactQuestionType = z.infer<typeof contactQuestionTypeSchema>

/**
 * Catégorie légale d'entreprise — vocabulaire fermé (V0).
 * Une seule valeur pour l'instant ; les autres seront ajoutées plus tard.
 * Utilisée par `eligibilite.categorie_legale` (autorisé / interdit).
 */
export const categorieLegaleSchema = z.enum(['micro_entrepreneur']);
export type CategorieLegale = z.infer<typeof categorieLegaleSchema>
