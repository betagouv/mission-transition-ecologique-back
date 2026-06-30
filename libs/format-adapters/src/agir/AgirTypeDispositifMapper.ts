import type { TypeAide } from '@tee-backoffice/canonical'
import { TypeAideMapper } from '../shared/TypeAideMapper'
import { AgirVocabulary } from './AgirVocabulary'

/**
 * Derives the AGIR `typeDispositif` (a single string) from the canonical
 * `types_aides`. The exact format is unconfirmed (single value? pipe list?
 * enum?), so the join is isolated here to adjust without touching the exporter:
 * default = the display labels joined by {@link AgirVocabulary.TYPE_DISPOSITIF_SEPARATOR}.
 */
export class AgirTypeDispositifMapper {
  static fromTypes(types: readonly TypeAide[]): string {
    return TypeAideMapper.toFrLabels(types).join(AgirVocabulary.TYPE_DISPOSITIF_SEPARATOR)
  }
}
