import type { StatutDispositif } from '@tee-backoffice/canonical'

/** Collapsed lifecycle status shared by every export (`actif`/`indisponible`). */
export type Statut = 'actif' | 'indisponible'

/**
 * Collapses `statut_dispositif` to a single `statut`
 * (`valide → actif`, `temporairement_indisponible → indisponible`) for the
 * Etalab/Grist (open data) projection. Only these two statuses ship to
 * data.gouv; the rest are filtered out upstream. AGIR has its own, wider
 * vocabulary (`AgirEtatMapper`) and does not use this mapper.
 */
export class StatutMapper {
  private static readonly STATUT: Record<string, Statut> = {
    valide: 'actif',
    temporairement_indisponible: 'indisponible',
  }

  /** Whether the status ships to the open-data (Grist) export. */
  static isExportable(statut: StatutDispositif): boolean {
    return statut in StatutMapper.STATUT
  }

  static toStatut(statut: StatutDispositif): Statut {
    const mapped = StatutMapper.STATUT[statut]
    if (!mapped) {
      throw new Error(`statut_dispositif non exportable: ${statut}`)
    }
    return mapped
  }
}
