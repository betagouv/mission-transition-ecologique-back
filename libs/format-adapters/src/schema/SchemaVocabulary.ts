import type { TypeAide } from '@tee-backoffice/canonical'
import type { Cible } from './schema-row.types'

/**
 * Single place for every target string and default the Etalab projection emits.
 * Values flagged « à confirmer » are placeholders until the data.gouv schema
 * managers (Grist « Gestion des schémas ») fix the reference lists.
 */
export class SchemaVocabulary {
  /** Public TEE site, used to build the default `url_source` and step links. */
  static readonly TEE_BASE_URL = 'https://mission-transition-ecologique.beta.gouv.fr'
  static readonly DATAGOUV_UTM = '?utm_campaign=openData'

  /** All our dispositifs target companies. */
  static readonly CIBLE: Cible = 'professionnels'

  /** Provenance tag for every row this pipeline exports (data.gouv / Grist). */
  static readonly SOURCE = 'tee' as const

  /** National coverage COG code, the `eligibilite_geographique` default. */
  static readonly COG_NATIONAL = 'PAYS-99100'

  /** `ciblage_secteur_activite` default when no sector restriction is declared. */
  static readonly SECTEUR_TOUS = "tous secteurs d'activité"

  /** Pipe separator shared by every multi-value Etalab column. */
  static readonly PIPE = '|'

  /**
   * Canonical `types_aides` enum → Etalab `types_aides` vocabulary.
   * ⚠️ à confirmer contre la liste Grist « Gestion des schémas » (p/5).
   */
  static readonly TYPE_AIDE: Record<TypeAide, string> = {
    assistance: 'assistance',
    avantage_fiscal: 'avantage fiscal',
    conseil: 'conseil',
    etude: 'étude',
    financement: 'financement',
    formation: 'formation',
    information: 'information',
    pret: 'prêt',
  }

  /** Porteur roles assigned by position (canonical carries no role). */
  static readonly ROLE_CONTACT = ['instructeur', 'diffuseur'] as const
  static readonly ROLE_AUTRE = ['diffuseur'] as const

  /**
   * Marker matched (case-insensitive, on nom/nom_normalise) to expand a single
   * "CCI ou CMA" operator into the two national heads. ⚠️ heuristique à
   * confirmer (le canonical ne porte plus le tag d'origine).
   */
  static readonly CCI_CMA_MARKER = 'cci ou cma'
  static readonly CCI_FRANCE = { nom: 'CCI FRANCE', siren: '187500020' }
  static readonly CMA_FRANCE = { nom: 'CMA FRANCE (APCM)', siren: '187500046' }

  /** Legal-form exclusion label for the canonical `micro_entrepreneur` value. */
  static readonly FORME_MICRO_ENTREPRENEUR = 'Microentrepreneur'

  /**
   * NAF section letter → coarse `ciblage_secteur_activite` label.
   * ⚠️ granularité à valider ; food divisions (10/11) surfaced as `IAA` upstream.
   */
  static readonly SECTEUR_PAR_SECTION: Record<string, string> = {
    A: 'agriculture',
    B: 'industrie',
    C: 'industrie',
    D: 'industrie',
    E: 'industrie',
    F: 'construction',
    G: 'commerce',
    H: 'transport',
    I: 'hébergement et restauration',
    J: 'information et communication',
    K: 'finance et assurance',
    L: 'immobilier',
    M: 'services',
    N: 'services',
    O: 'administration publique',
    P: 'enseignement',
    Q: 'santé et action sociale',
    R: 'arts et loisirs',
    S: 'autres services',
    T: 'services',
    U: 'organismes extra-territoriaux',
  }

  static readonly SECTEUR_IAA = 'IAA'
}
