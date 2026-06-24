import type { TypeAide } from '@tee-backoffice/canonical'

/**
 * Conversions de `types_aides` (les 8 types du pivot) vers les cibles.
 *
 * - **Schéma interministériel** : les 8 valeurs du pivot SONT les valeurs
 *   Etalab (décision : copie à l'identique) → jointes par des pipes.
 * - **programs.json** : `nature de l'aide` est un libellé FR **unique**. Le
 *   pivot porte un tableau ; on retient le type le plus saillant (le label
 *   « privilégié » côté front — financement d'abord, cf. ADR 0007) et on le
 *   traduit en libellé historique accentué.
 */
export class TypeAideMapper {
  /** Libellés historiques de programs.json (`nature de l'aide`). */
  private static readonly FR_LABEL: Record<TypeAide, string> = {
    assistance: 'assistance',
    avantage_fiscal: 'avantage fiscal',
    conseil: 'conseil',
    etude: 'étude',
    financement: 'financement',
    formation: 'formation',
    information: 'information',
    pret: 'prêt',
  }

  /** Ordre de saillance pour réduire un tableau à un libellé unique. */
  private static readonly PRIORITY: readonly TypeAide[] = [
    'financement',
    'formation',
    'etude',
    'pret',
    'avantage_fiscal',
    'conseil',
    'assistance',
    'information',
  ]

  /** Schéma Etalab : les types du pivot, joints par des pipes. */
  static toSchema(types: readonly TypeAide[]): string {
    return types.join('|')
  }

  // ⚠️ ONE-SHOT IMPORT (Baserow → Payload): the inverse table + fromNatureAideLabel
  // below exist only for the historical import. Delete with the import path after
  // migration — see README cleanup checklist.
  /** Inverse table (`nature de l'aide` → type pivot), derived from {@link FR_LABEL}. */
  private static readonly LABEL_TO_TYPE: Record<string, TypeAide> = Object.fromEntries(
    Object.entries(TypeAideMapper.FR_LABEL).map(([type, label]) => [label, type as TypeAide]),
  )

  /** programs.json : un libellé FR unique (type le plus saillant). */
  static toNatureAideLabel(types: readonly TypeAide[]): string {
    const primary = TypeAideMapper.PRIORITY.find((type) => types.includes(type)) ?? types[0]
    return primary ? TypeAideMapper.FR_LABEL[primary] : ''
  }

  /** `nature de l'aide` (libellé historique) → type pivot, ou `undefined` si inconnu. */
  static fromNatureAideLabel(label: string): TypeAide | undefined {
    return TypeAideMapper.LABEL_TO_TYPE[label]
  }
}
