import type { Source } from '@tee-backoffice/canonical'

/**
 * Centralized AGIR vocabulary: the exact display strings the AGIR consumer
 * expects. Kept in one place so they can be adjusted from a single file once
 * confirmed.
 *
 * ⚠️ Every value here is a PLACEHOLDER to confirm with AGIR (`etatDispositif`,
 * `typeDispositif`, `source`, `typeSecteur`…). The shapes are locked; only the
 * literal strings may change.
 */
export class AgirVocabulary {
  /** `source` mapping (lowercased). */
  static readonly SOURCE: Record<Source, 'tee' | 'ademe' | 'schema'> = {
    INTERNE: 'tee',
    ADEME: 'ademe',
    SCHEMA: 'schema',
  }

  /** `etatDispositif` (liste + détail), keyed by the exportable `statut_dispositif`. */
  static readonly ETAT = {
    valide: 'inProd',
    temporairement_indisponible: 'temporairement indisponible',
  } as const

  /** Pivot ADEME `statut`, keyed by the exportable `statut_dispositif`. */
  static readonly STATUT = {
    valide: 'actif',
    temporairement_indisponible: 'indisponible',
  } as const

  /** Separator used to join several aid types into `typeDispositif`. */
  static readonly TYPE_DISPOSITIF_SEPARATOR = ' | '

  /** `secteurGeographique.typeSecteur`, deduced from the COG level prefix. */
  static readonly TYPE_SECTEUR: Record<string, string> = {
    PAYS: 'National',
    REG: 'Régional',
    DEP: 'Départemental',
    ARR: 'Arrondissement',
    CAN: 'Cantonal',
    COM: 'Communal',
    OM: 'Outre-mer',
    EPCI: 'Intercommunal',
  }

  /** Fallback when the geographic level cannot be deduced (mixed or unknown). */
  static readonly TYPE_SECTEUR_INCONNU = 'Inconnu'
}
