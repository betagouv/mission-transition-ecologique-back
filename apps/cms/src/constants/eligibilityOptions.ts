/**
 * Eligibility select options, shared between the `Programs` collection fields and
 * the canonical mapper (which derives its editorial `texte` labels from them).
 * Single source of truth: edit a label once here, both places stay in sync.
 */

export const COMPANY_SIZE_OPTIONS = [
  { label: '0 à 9 salariés', value: '0-9' },
  { label: '10 à 19 salariés', value: '10-19' },
  { label: '20 à 49 salariés', value: '20-49' },
  { label: '50 à 249 salariés', value: '50-249' },
  { label: '250 à 499 salariés', value: '250-499' },
  { label: '500 à 4999 salariés', value: '500-4999' },
  { label: '+ 5000 salariés', value: '5000+' },
  { label: 'Autre taille spécifique', value: 'other' },
] as const

export const ACTIVITY_SECTOR_OPTIONS = [
  { label: "Tous secteurs d'activité", value: 'all' },
  { label: 'Agriculture', value: 'agriculture' },
  { label: 'Industrie', value: 'industrie' },
  { label: 'Tertiaire', value: 'tertiaire' },
  { label: 'Commerce', value: 'commerce' },
  { label: 'Artisanat', value: 'artisanat' },
  { label: 'Tourisme', value: 'tourisme' },
  { label: 'Autre secteur spécifique', value: 'other' },
  { label: 'Code NAF spécifique associé', value: 'naf-code' },
] as const
