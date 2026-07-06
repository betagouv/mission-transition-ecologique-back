import type { TypeAide } from '@tee-backoffice/canonical'
import { SchemaVocabulary } from './SchemaVocabulary'

/** Maps canonical `types_aides` to the Etalab `types_aides` column (pipe-joined). */
export class TypesAidesSchemaMapper {
  static toColumn(types: readonly TypeAide[]): string {
    return types.map((type) => SchemaVocabulary.TYPE_AIDE[type]).join(SchemaVocabulary.PIPE)
  }
}
