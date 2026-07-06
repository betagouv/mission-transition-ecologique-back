import type { CanonicalProgramData } from '@tee-backoffice/canonical'
import { NafSectionResolver } from '../shared/NafSectionResolver'
import { SchemaVocabulary } from './SchemaVocabulary'

type Eligibilite = CanonicalProgramData['eligibilite']

/**
 * Projects the canonical NAF targeting to the Etalab sector columns:
 * `ciblage_naf`/`ciblage_naf_exclusions` (raw codes) and the coarse
 * `ciblage_secteur_activite` labels (required for the entreprise schema).
 *
 * The canonical mostly carries NAF codes, not the loose sector labels the schema
 * asks for, so labels are derived from NAF sections; no restriction at all means
 * « tous secteurs d'activité ». ⚠️ granularité des libellés à confirmer.
 */
export class SecteurActiviteMapper {
  /** Food/beverage NAF divisions, surfaced as the distinct `IAA` label. */
  private static readonly IAA_DIVISIONS = /^(10|11)/

  static toCiblageSecteur(eligibilite: Eligibilite): string {
    const inclusions = SecteurActiviteMapper.inclusions(eligibilite)
    if (inclusions.length === 0) return SchemaVocabulary.SECTEUR_TOUS

    const labels = new Set<string>()
    if (inclusions.some((code) => SecteurActiviteMapper.IAA_DIVISIONS.test(code))) {
      labels.add(SchemaVocabulary.SECTEUR_IAA)
    }
    for (const section of NafSectionResolver.sectionsOf(inclusions)) {
      const label = SchemaVocabulary.SECTEUR_PAR_SECTION[section]
      if (label) labels.add(label)
    }

    if (labels.size === 0) return SchemaVocabulary.SECTEUR_TOUS
    return [...labels].join(SchemaVocabulary.PIPE)
  }

  static toCiblageNaf(eligibilite: Eligibilite): string | undefined {
    const inclusions = SecteurActiviteMapper.inclusions(eligibilite)
    return inclusions.length === 0 ? undefined : inclusions.join(SchemaVocabulary.PIPE)
  }

  static toCiblageNafExclusions(eligibilite: Eligibilite): string | undefined {
    const exclusions = eligibilite?.secteur_activite?.structure?.exclusions ?? []
    return exclusions.length === 0 ? undefined : exclusions.join(SchemaVocabulary.PIPE)
  }

  private static inclusions(eligibilite: Eligibilite): readonly string[] {
    return eligibilite?.secteur_activite?.structure?.inclusions ?? []
  }
}
