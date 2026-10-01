import type { StatutProjet } from '@tee-backoffice/canonical'
import { AgirVocabulary } from '../AgirVocabulary'

/** AGIR lifecycle value of a project (`en_prod` / `remplace`). */
export type AgirProjetEtat = (typeof AgirVocabulary.ETAT_PROJET)[StatutProjet]

/** Maps `statut_projet` to the AGIR lifecycle value (index `etatProjet`, pivot `statut`). */
export class AgirProjetEtatMapper {
  static toEtat(statut: StatutProjet): AgirProjetEtat {
    return AgirVocabulary.ETAT_PROJET[statut]
  }
}
