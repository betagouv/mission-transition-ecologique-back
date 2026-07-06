/**
 * Etalab Table Schema row for the `dispositif-aide-professionnels` schema
 * (superset of `dispositif-aide`). Every column is a CSV string (or `undefined`
 * when omitted): arrays are pipe-joined, structured objects are JSON-stringified
 * upstream. `SchemaProgramMapper` produces every column; `SchemaFitChecker` then
 * decides which schemas the row satisfies.
 */
export interface SchemaRow {
  // --- core (`dispositif-aide`) ---
  id: string
  titre: string
  promesse?: string
  description: string
  eligibilite: string
  types_aides: string
  porteurs: string
  programmes_parents?: string
  url_source?: string
  cibles: string
  eligibilite_geographique: string
  eligibilite_geographique_exclusions?: string
  date_ouverture?: string
  date_cloture?: string
  date_mise_a_jour: string
  // --- entreprise extension (`dispositif-aide-professionnels`) ---
  base_juridique?: string
  eligibilite_effectif_minimal?: string
  eligibilite_effectif_maximal?: string
  eligibilite_categorie_taille_entreprise?: string
  eligibilite_annees_existence_minimal?: string
  eligibilite_forme_juridique?: string
  eligibilite_forme_juridique_exclusions?: string
  ciblage_secteur_activite?: string
  ciblage_naf?: string
  ciblage_naf_exclusions?: string
  chainage_paiement?: string
}

/** Etalab schema names this package projects to. */
export const SCHEMA_CORE = 'dispositif-aide'
export const SCHEMA_ENTREPRISE = 'dispositif-aide-professionnels'

export type SchemaName = typeof SCHEMA_CORE | typeof SCHEMA_ENTREPRISE

/** Required columns per schema (must be non-empty for the row to fit). */
export const REQUIRED_FIELDS: Record<SchemaName, readonly (keyof SchemaRow)[]> = {
  [SCHEMA_CORE]: [
    'id',
    'titre',
    'description',
    'eligibilite',
    'types_aides',
    'porteurs',
    'cibles',
    'eligibilite_geographique',
    'date_mise_a_jour',
  ],
  [SCHEMA_ENTREPRISE]: [
    'id',
    'titre',
    'description',
    'eligibilite',
    'types_aides',
    'porteurs',
    'cibles',
    'eligibilite_geographique',
    'date_mise_a_jour',
    'ciblage_secteur_activite',
  ],
}

/** A `porteurs` entry, serialized as JSON into the `porteurs` column. */
export interface Porteur {
  nom: string
  siren?: string
  roles: PorteurRole[]
}

export type PorteurRole = 'instructeur' | 'diffuseur' | 'financeur'

/** Etalab `cibles` values. */
export type Cible = 'professionnels' | 'particuliers' | 'associations' | 'secteur public'
