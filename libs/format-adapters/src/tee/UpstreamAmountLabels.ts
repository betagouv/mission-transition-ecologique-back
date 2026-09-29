import type { TypeAide } from '@tee-backoffice/canonical'

/**
 * Amount and duration labels written by upstream `programs.json` (its dynamic
 * keys, kept as `montant.type` / `duree.type` by `TeeImporter`), per aid type.
 * A consumer holding one amount field per aid type (the CMS) matches them here
 * instead of knowing the upstream wording. A label listed for no aid type (e.g.
 * a financing amount on a study) has no such field.
 */
export class UpstreamAmountLabels {
  private static readonly MONTANT: Partial<Record<TypeAide, readonly string[]>> = {
    financement: ['montant du financement'],
    pret: ['montant du prêt'],
    avantage_fiscal: ["montant de l'avantage fiscal"],
    formation: ["coût de l'accompagnement"],
    etude: ["coût de l'accompagnement"],
  }

  private static readonly DUREE: Partial<Record<TypeAide, readonly string[]>> = {
    formation: ["durée de l'accompagnement"],
    etude: ["durée de l'accompagnement"],
  }

  static montantLabels(typeAide: TypeAide): readonly string[] {
    return UpstreamAmountLabels.MONTANT[typeAide] ?? []
  }

  static dureeLabels(typeAide: TypeAide): readonly string[] {
    return UpstreamAmountLabels.DUREE[typeAide] ?? []
  }
}
