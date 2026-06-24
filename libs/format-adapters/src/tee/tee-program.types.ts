/**
 * Forme cible **iso `docs/sources/programs.json`** (sans `publicodes`).
 *
 * Les clés conservent leur graphie historique (français accentué, espaces,
 * apostrophes). L'index `[string]: unknown` couvre les clés de montant/durée
 * **dynamiques** (« montant du financement », « coût de l'accompagnement »…),
 * dont le libellé est porté par le pivot (`montant.type` / `duree.type`).
 */
export interface TeeProgram {
  id: string
  type: 'tee'
  titre: string
  promesse?: string
  description: string
  'description longue'?: string
  metaTitre?: string
  metaDescription?: string
  illustration?: string
  'opérateur de contact': string
  'autres opérateurs'?: string[]
  'contact question'?: string
  "nature de l'aide": string
  url?: string
  'début de validité'?: string
  'fin de validité'?: string
  'aide temporairement indisponible'?: 'oui'
  objectifs?: TeeObjectif[]
  "conditions d'éligibilité"?: TeeConditionsEligibilite
  eligibilityData?: TeeEligibilityData
  'champs conditionnels'?: TeeChampConditionnel[]
  /** Clés dynamiques de montant/durée portées par `montant.type` / `duree.type`. */
  [montantOrDureeKey: string]: unknown
}

export interface TeeObjectif {
  description: string
  liens?: TeeLien[]
}

/** Lien externe `{ lien, texte }` ou renvoi vers le formulaire TEE `{ formulaire: true }`. */
export type TeeLien = { lien: string; texte: string } | { formulaire: true }

export interface TeeConditionsEligibilite {
  "taille de l'entreprise"?: string[]
  'secteur géographique'?: string[]
  "secteur d'activité"?: string[]
  "nombre d'années d'activité"?: string[]
  "autres critères d'éligibilité"?: string[]
}

export interface TeeEligibilityData {
  company: {
    allowedNafSections?: string[]
    minEmployees?: string
    maxEmployees?: string
    allowedRegion?: string[]
    excludeMicroentrepreneur?: boolean
  }
  /** Omitted entirely when the program carries no validity dates (iso programs.json). */
  validity?: {
    start?: string
    end?: string
  }
  priorityObjectives?: string[]
}

/** Reconstruit depuis `variantes` (best-effort, voir `docs/features/004-formats-exports.md`). */
export interface TeeChampConditionnel {
  'toutes ces conditions': string[]
  'Montant du dispositif'?: string
  'Eligibilité taille'?: string
  "autres critères d'éligibilité"?: string[]
}
