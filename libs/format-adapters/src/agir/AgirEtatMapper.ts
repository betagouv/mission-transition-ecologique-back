import type { StatutDispositif } from '@tee-backoffice/canonical'
import { AgirVocabulary } from './AgirVocabulary'

/** Exportable `statut_dispositif` values (the keys of {@link AgirVocabulary.ETAT}). */
export type ExportableStatut = keyof typeof AgirVocabulary.ETAT

/** AGIR lifecycle value (`en_prod` / `temporairement_indisponible` / `remplace`). */
export type AgirEtat = (typeof AgirVocabulary.ETAT)[ExportableStatut]

/**
 * Maps `statut_dispositif` to the AGIR lifecycle value (index/detail
 * `etatDispositif`, pivot `statut`) and decides exportability. `valide`,
 * `temporairement_indisponible`, `remplace` and `archive` all reach AGIR; only
 * `inconnu` is absent from the index and returns 404. Archived aids stay
 * transmitted (carried by `date_cloture`).
 */
export class AgirEtatMapper {
  /** Whether the program ships to AGIR based on its `statut_dispositif`. */
  static isExportable(statut: StatutDispositif): statut is ExportableStatut {
    return statut in AgirVocabulary.ETAT
  }

  /** AGIR lifecycle value for an exportable status. Caller must filter beforehand. */
  static toEtat(statut: StatutDispositif): AgirEtat {
    if (!AgirEtatMapper.isExportable(statut)) {
      throw new Error(`statut_dispositif non exportable vers AGIR: ${statut}`)
    }
    return AgirVocabulary.ETAT[statut]
  }
}
