import type { CanonicalProgram } from '@tee-backoffice/canonical'

/**
 * Politique d'inclusion des exports.
 *
 * Le **statut d'édition** décide ce qui sort vers les cibles publiques
 * (programs.json, AGIR) : seuls les dispositifs *publiés* (`pret_prod`) sont
 * exportés. Le **statut de dispositif** (`temporairement_indisponible`,
 * `remplace`, `archive`…) n'est pas un filtre — il est transmis tel quel.
 *
 * L'export Grist (schéma interministériel) ne filtre rien : il transmet tout.
 */
export class ExportPolicy {
  /** Publié = prêt pour la production. */
  static isPublished(program: CanonicalProgram): boolean {
    return program.statutEdition === 'pret_prod'
  }
}
