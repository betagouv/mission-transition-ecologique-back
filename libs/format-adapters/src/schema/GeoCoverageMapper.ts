import type { CanonicalProgramData } from '@tee-backoffice/canonical'
import { SchemaVocabulary } from './SchemaVocabulary'

type Eligibilite = CanonicalProgramData['eligibilite']

/**
 * Projects the canonical geographic targeting to the Etalab COG columns. The
 * canonical already stores prefixed COG codes (`REG-84`, `DEP-13`…), so the
 * mapper only joins them; absence of any inclusion means national coverage
 * (`PAYS-99100`), the schema default.
 */
export class GeoCoverageMapper {
  static toCoverage(eligibilite: Eligibilite): string {
    const inclusions = eligibilite?.secteur_geographique?.structure?.inclusions ?? []
    if (inclusions.length === 0) return SchemaVocabulary.COG_NATIONAL
    return inclusions.join(SchemaVocabulary.PIPE)
  }

  static toExclusions(eligibilite: Eligibilite): string | undefined {
    const exclusions = eligibilite?.secteur_geographique?.structure?.exclusions ?? []
    if (exclusions.length === 0) return undefined
    return exclusions.join(SchemaVocabulary.PIPE)
  }
}
