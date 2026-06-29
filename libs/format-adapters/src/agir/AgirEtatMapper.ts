import type { StatutDispositif } from '@tee-backoffice/canonical'
import { AgirVocabulary } from './AgirVocabulary'

/** Exportable `statut_dispositif` values (the keys of {@link AgirVocabulary.ETAT}). */
export type ExportableStatut = keyof typeof AgirVocabulary.ETAT

/**
 * Maps `statut_dispositif` to the AGIR `etatDispositif` string, and decides
 * exportability. Only `valide` and `temporairement_indisponible` reach AGIR;
 * `archive`/`remplace`/`inconnu` are absent from the index and return 404.
 */
export class AgirEtatMapper {
  /** Whether the program ships to AGIR based on its `statut_dispositif`. */
  static isExportable(statut: StatutDispositif): statut is ExportableStatut {
    return statut in AgirVocabulary.ETAT
  }

  /** `etatDispositif` for an exportable status. Caller must filter beforehand. */
  static toEtat(statut: StatutDispositif): string {
    if (!AgirEtatMapper.isExportable(statut)) {
      throw new Error(`statut_dispositif non exportable vers AGIR: ${statut}`)
    }
    return AgirVocabulary.ETAT[statut]
  }
}
