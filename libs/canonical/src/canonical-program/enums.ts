import { z } from 'zod'

/**
 * Closed vocabularies of the canonical (pivot) format.
 * Single source of truth — every schema and projection reads from here.
 */

/** Provenance du dispositif. */
export const sourceSchema = z.enum(['ADEME', 'INTERNE', 'SCHEMA'])
export type Source = z.infer<typeof sourceSchema>

/**
 * Statut éditorial / cycle de vie.
 * `remplace` impose `remplace_par` (voir refine du cas général).
 */
export const statutSchema = z.enum([
  'en_creation',
  'en_reecriture',
  'pret_prod',
  'actif',
  'temporairement_indisponible',
  'archive',
  'remplace',
])
export type Statut = z.infer<typeof statutSchema>

/** Nature de l'aide (taxonomie du schéma de données). */
export const typeAideSchema = z.enum([
  'etude',
  'formation',
  'financement',
  'pret',
  'avantage_fiscal',
  'assistance',
  'information',
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
  'analyses',
  'ecoconception',
  'biodiversite',
])
export type Theme = z.infer<typeof themeSchema>

/** Canal de contact pour les questions. */
export const contactQuestionTypeSchema = z.enum(['ADEME', 'CE', 'email', 'url'])
export type ContactQuestionType = z.infer<typeof contactQuestionTypeSchema>
