import type { TypeAide } from '@tee-backoffice/canonical'

/**
 * Maps the pivot's `types_aides` (8 types) to target formats.
 *
 * programs.json's `nature de l'aide` is a single FR label, whereas the pivot
 * carries a list: we keep the most salient type (financement first, cf. ADR
 * 0007) and render it as the historical accented label.
 */
export class TypeAideMapper {
  /** Historical programs.json labels (`nature de l'aide`). */
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

  /** Salience order used to reduce a list to a single label. */
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

  /** Etalab schema: pivot types joined by pipes. */
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

  /** programs.json: a single FR label (most salient type). */
  static toNatureAideLabel(types: readonly TypeAide[]): string {
    const primary = TypeAideMapper.PRIORITY.find((type) => types.includes(type)) ?? types[0]
    return primary ? TypeAideMapper.FR_LABEL[primary] : ''
  }

  /** `nature de l'aide` (historical label) → pivot type, or `undefined` if unknown. */
  static fromNatureAideLabel(label: string): TypeAide | undefined {
    return TypeAideMapper.LABEL_TO_TYPE[label]
  }
}
