import type { Source } from '@tee-backoffice/canonical'
import { AgirVocabulary } from './AgirVocabulary'

/** AGIR `source` values (lowercased canonical sources). */
export type AgirSource = (typeof AgirVocabulary.SOURCE)[Source]

/** Maps the canonical `source` to its lowercased AGIR value. */
export class AgirSourceMapper {
  static toAgir(source: Source): AgirSource {
    return AgirVocabulary.SOURCE[source]
  }
}
