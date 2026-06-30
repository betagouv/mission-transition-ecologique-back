import type { StatutDispositif, StatutEdition, Theme, TypeAide } from '@tee-backoffice/canonical'
import type { GeographicArea, Program } from '../../../payload-types'
import {
  ACTIVITY_SECTOR_OPTIONS,
  COMPANY_SIZE_OPTIONS,
} from '@/constants/eligibilityOptions'

/**
 * Lookup tables between the Payload `Program` vocabularies and the canonical
 * pivot enums. Kept as plain data, separate from the mapper, so the editorial
 * choices encoded here (status correspondence, EN→FR themes, amount labels) are
 * reviewable in one place.
 */

type AidType = Program['aidType']
type WorkflowStatus = NonNullable<Program['workflowStatus']>
type PayloadTheme = NonNullable<Program['themes']>[number]
type CompanySize = NonNullable<Program['companySizes']>[number]
type CoverageType = GeographicArea['coverageType']

/** Maps a select-option list to a `value → label` record, keeping value typing. */
function labelsByValue<O extends readonly { label: string; value: string }[]>(
  options: O,
): Record<O[number]['value'], string> {
  return Object.fromEntries(options.map((option) => [option.value, option.label])) as Record<
    O[number]['value'],
    string
  >
}

/** Number of numeric size buckets (all but `other`); selecting them all = no constraint. */
export const NUMERIC_COMPANY_SIZE_COUNT = 7

/** Aid nature: single Payload `aidType` → one canonical `types_aides` value. */
export const AID_TYPE_TO_CANONICAL: Record<AidType, TypeAide> = {
  financement: 'financement',
  pret: 'pret',
  'avantage-fiscal': 'avantage_fiscal',
  formation: 'formation',
  'diagnostic-etude': 'etude',
}

/**
 * Editorial status (`statut_edition`) — content authoring progress. No canonical
 * state matches "en-relecture" exactly; it is folded into `en_creation` (content
 * not yet final).
 */
export const WORKFLOW_STATUS_TO_EDITION: Record<WorkflowStatus, StatutEdition> = {
  'en-creation': 'en_creation',
  'en-relecture': 'en_creation',
  'en-cours-publication': 'pret_prod',
  publie: 'pret_prod',
  'en-cours-modification': 'en_reecriture',
  importe: 'inconnu',
  annule: 'abandonne',
  archive: 'archive',
  remplace: 'pret_prod',
}

/** Program status (`statut_dispositif`) — real validity of the aid. */
export const WORKFLOW_STATUS_TO_DISPOSITIF: Record<WorkflowStatus, StatutDispositif> = {
  'en-creation': 'inconnu',
  'en-relecture': 'inconnu',
  'en-cours-publication': 'inconnu',
  publie: 'valide',
  'en-cours-modification': 'valide',
  importe: 'inconnu',
  annule: 'archive',
  archive: 'archive',
  remplace: 'remplace',
}

/** Themes: Payload uses English values, the canonical taxonomy is French. */
export const THEME_TO_CANONICAL: Record<PayloadTheme, Theme> = {
  energy: 'energie',
  waste: 'dechets',
  mobility: 'mobilite',
  environmental: 'environnemental',
  building: 'batiment',
  water: 'eau',
  'eco-design': 'ecoconception',
  rh: 'rh',
  biodiversite: 'biodiversite',
}

/**
 * Self-described amount per aid type: the label travels with the value into the
 * pivot, so no aid-type → label rebuild is needed downstream. `field` points at
 * the Payload field carrying the amount string.
 */
export const MONTANT_BY_AID_TYPE: Record<AidType, { label: string; field: keyof Program }> = {
  financement: { label: 'Montant du financement', field: 'fundingAmount' },
  pret: { label: 'Montant du prêt', field: 'loanAmount' },
  'avantage-fiscal': { label: "Montant de l'avantage fiscal", field: 'taxBenefitAmount' },
  formation: { label: 'Coût restant à charge', field: 'formationRemainingCost' },
  'diagnostic-etude': { label: 'Coût restant à charge', field: 'studyRemainingCost' },
}

/** Self-described duration — only the aid types that carry one in Payload. */
export const DUREE_BY_AID_TYPE: Partial<Record<AidType, { label: string; field: keyof Program }>> = {
  formation: { label: 'Durée de la formation', field: 'formationDuration' },
  'diagnostic-etude': { label: "Durée du diagnostic ou de l'étude", field: 'studyDuration' },
}

/** Company-size bucket → numeric bounds (max omitted means open-ended). */
export const COMPANY_SIZE_BOUNDS: Record<CompanySize, { min?: number; max?: number }> = {
  '0-9': { min: 0, max: 9 },
  '10-19': { min: 10, max: 19 },
  '20-49': { min: 20, max: 49 },
  '50-249': { min: 50, max: 249 },
  '250-499': { min: 250, max: 499 },
  '500-4999': { min: 500, max: 4999 },
  '5000+': { min: 5000 },
  other: {},
}

/** Human labels for the activity sectors, reused in the editorial `texte`. */
export const ACTIVITY_SECTOR_LABELS = labelsByValue(ACTIVITY_SECTOR_OPTIONS)

/** Human labels for the size buckets, reused in the editorial `texte`. */
export const COMPANY_SIZE_LABELS = labelsByValue(COMPANY_SIZE_OPTIONS)

/** Geographic coverage type → COG prefix. `autre` carries no structured code. */
export const COVERAGE_TYPE_TO_COG_PREFIX: Record<CoverageType, string | null> = {
  region: 'REG',
  departement: 'DEP',
  commune: 'COM',
  epci: 'EPCI',
  autre: null,
}
