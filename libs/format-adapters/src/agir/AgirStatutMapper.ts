import type { StatutDispositif } from '@tee-backoffice/canonical'
import { AgirVocabulary } from './AgirVocabulary'

/** Single ADEME pivot status (collapsed from `statut_dispositif`). */
export type AdemeStatut = (typeof AgirVocabulary.STATUT)[keyof typeof AgirVocabulary.STATUT]

/**
 * Collapses `statut_dispositif` to the ADEME pivot's single `statut`
 * (`valide → actif`, `temporairement_indisponible → indisponible`). The other
 * statuses never reach the pivot (the caller filters with {@link AgirEtatMapper}).
 */
export class AgirStatutMapper {
  static toStatut(statut: StatutDispositif): AdemeStatut {
    const mapped = (AgirVocabulary.STATUT as Record<string, AdemeStatut>)[statut]
    if (!mapped) {
      throw new Error(`statut_dispositif non exportable vers le pivot ADEME: ${statut}`)
    }
    return mapped
  }
}
