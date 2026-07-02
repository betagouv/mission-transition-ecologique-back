import { COMPANY_SIZE_BOUNDS } from '@/services/canonical/canonicalMappings'

/**
 * Variant select options, shared between the `Programs` collection variant fields
 * and the canonical mapper. Single source of truth for the variant vocabulary.
 */

/** Short, useful-only list of condition types a variant may target. */
export const CONDITION_TYPE_OPTIONS = [
  { label: "Taille d'entreprise", value: 'companySize' },
  { label: 'Zone géographique', value: 'geographicArea' },
] as const

/**
 * Closed list of base fields a variant may override from a plain text value.
 * Each maps to a key of the canonical `varianteModificationsSchema`. Operator and
 * eligibility overrides take one operator name / one editorial bullet per row;
 * add several rows to accumulate (e.g. two "Autres opérateurs" rows -> two
 * partners). This mirrors the real `champs conditionnels` of the source data.
 */
export const MODIFIABLE_FIELD_OPTIONS = [
  { label: "Montant de l'aide", value: 'montant' },
  { label: 'Durée', value: 'duree' },
  { label: 'Lien du dispositif', value: 'urlSource' },
  { label: 'Opérateur de contact', value: 'contactOperateur' },
  { label: 'Autres opérateurs', value: 'autresOperateurs' },
  { label: "Éligibilité (taille d'entreprise)", value: 'eligibiliteEffectif' },
  { label: "Autres critères d'éligibilité", value: 'autresCriteres' },
] as const

/**
 * Company-size bucket → numeric interval. Re-exported from `COMPANY_SIZE_BOUNDS`
 * so the variant mapping and the base eligibility mapping stay aligned on the
 * same bounds (no duplication). `'other'` carries no interval and is ignored.
 */
export const COMPANY_SIZE_TO_INTERVAL = COMPANY_SIZE_BOUNDS
