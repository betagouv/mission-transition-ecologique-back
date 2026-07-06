import type { CanonicalProgramData } from '@tee-backoffice/canonical'
import { RegionNameResolver } from '../shared/RegionNameResolver'
import { SchemaVocabulary } from './SchemaVocabulary'

type Eligibilite = CanonicalProgramData['eligibilite']

/**
 * Builds the Etalab `eligibilite` column: one bullet per criterion, folding the
 * structured canonical eligibility into prose readable by a public agent. The
 * effectif bullet is always emitted (defaulting to « Toutes tailles »), which
 * guarantees a non-empty required column.
 */
export class EligibiliteTextBuilder {
  static build(eligibilite: Eligibilite): string {
    const bullets: string[] = []
    const add = (label: string, value: string | undefined): void => {
      if (value) bullets.push(`- ${label} : ${value}`)
    }

    add('Éligibilité sectorielle', EligibiliteTextBuilder.texte(eligibilite?.secteur_activite?.texte))
    add('Codes NAF concernés', EligibiliteTextBuilder.naf(eligibilite))
    bullets.push(`- Effectif éligible : ${EligibiliteTextBuilder.effectif(eligibilite)}`)
    add("Ancienneté de l'entreprise", EligibiliteTextBuilder.texte(eligibilite?.anciennete?.texte))
    if (EligibiliteTextBuilder.excludesMicro(eligibilite)) {
      bullets.push('- Non éligible aux micro-entrepreneurs')
    }
    add('Aires géographiques éligibles', EligibiliteTextBuilder.regions(eligibilite))
    add('Autres conditions', EligibiliteTextBuilder.texte(eligibilite?.autres_criteres?.texte))

    return bullets.join('\n')
  }

  private static texte(texte: readonly string[] | undefined): string | undefined {
    if (!texte || texte.length === 0) return undefined
    return texte.join(' ; ')
  }

  private static naf(eligibilite: Eligibilite): string | undefined {
    const inclusions = eligibilite?.secteur_activite?.structure?.inclusions ?? []
    return inclusions.length === 0 ? undefined : inclusions.join(SchemaVocabulary.PIPE)
  }

  private static effectif(eligibilite: Eligibilite): string {
    const structure = eligibilite?.effectif?.structure
    if (!structure || (structure.min === undefined && structure.max === undefined)) {
      return 'Toutes tailles'
    }
    const min = structure.min ?? 0
    const max = structure.max ?? 'pas de maximum'
    return `${min} - ${max}`
  }

  private static excludesMicro(eligibilite: Eligibilite): boolean {
    const interdit = eligibilite?.categorie_legale?.structure?.interdit ?? []
    return interdit.includes('micro_entrepreneur')
  }

  private static regions(eligibilite: Eligibilite): string | undefined {
    const inclusions = eligibilite?.secteur_geographique?.structure?.inclusions ?? []
    if (inclusions.length === 0) return undefined
    const names = RegionNameResolver.namesOf(inclusions)
    return names.length === 0 ? undefined : names.join(', ')
  }
}
