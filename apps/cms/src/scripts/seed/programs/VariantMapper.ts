import { COMPANY_SIZE_BOUNDS } from '@/services/canonical/canonicalMappings'
import type { SourceProgram, SourceVariant } from './types'

type ConditionType = 'companySize' | 'geographicArea'
type ModifiableField =
  | 'montant'
  | 'duree'
  | 'urlSource'
  | 'contactOperateur'
  | 'autresOperateurs'
  | 'eligibiliteEffectif'
  | 'autresCriteres'

interface VariantCondition {
  conditionType: ConditionType
  companySizeValue?: string[]
  geographicAreaValue?: number[]
}

interface VariantModification {
  field: ModifiableField
  newValue?: string
  contactOperator?: number
  otherOperators?: number[]
}

export interface SeedVariant {
  conditions: VariantCondition[]
  modifications: VariantModification[]
}

/**
 * Maps the source `champs conditionnels` to the Payload `variants` field. Region
 * names resolve to geographic-area IDs, headcount thresholds resolve to company
 * size buckets, and operator names resolve to operator IDs (created upstream by
 * OperatorImporter). A variant missing either a condition or a modification is
 * dropped, matching the canonical "at least one of each" rule.
 */
export class VariantMapper {
  map(
    program: SourceProgram,
    operatorIdByName: Map<string, number>,
    regionIdByName: Map<string, number>,
  ): SeedVariant[] | undefined {
    const variants = (program['champs conditionnels'] ?? [])
      .map((source) => this.mapVariant(source, operatorIdByName, regionIdByName))
      .filter((variant): variant is SeedVariant => variant !== null)
    return variants.length > 0 ? variants : undefined
  }

  /** Stable key to match a source region name against a seeded geographic area. */
  static normalizeRegionName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
  }

  private mapVariant(
    source: SourceVariant,
    operatorIdByName: Map<string, number>,
    regionIdByName: Map<string, number>,
  ): SeedVariant | null {
    const conditions = this.mapConditions(source, regionIdByName)
    const modifications = this.mapModifications(source, operatorIdByName)
    if (conditions.length === 0 || modifications.length === 0) return null
    return { conditions, modifications }
  }

  private conditionStrings(source: SourceVariant): string[] {
    return source['une de ces conditions'] ?? source['toutes ces conditions'] ?? []
  }

  private mapConditions(
    source: SourceVariant,
    regionIdByName: Map<string, number>,
  ): VariantCondition[] {
    const strings = this.conditionStrings(source)
    const conditions: VariantCondition[] = []

    const regionIds = strings
      .map((value) => /^\s*région\s*=\s*(.+)$/i.exec(value)?.[1]?.trim())
      .filter((name): name is string => Boolean(name))
      .map((name) => regionIdByName.get(VariantMapper.normalizeRegionName(name)))
      .filter((id): id is number => id !== undefined)
    if (regionIds.length > 0) {
      conditions.push({ conditionType: 'geographicArea', geographicAreaValue: [...new Set(regionIds)] })
    }

    const interval = this.parseEffectif(strings)
    if (interval) {
      const buckets = this.bucketsForInterval(interval.min, interval.max)
      if (buckets.length > 0) {
        conditions.push({ conditionType: 'companySize', companySizeValue: buckets })
      }
    }
    return conditions
  }

  private parseEffectif(strings: string[]): { min?: number; max?: number } | null {
    let min: number | undefined
    let max: number | undefined
    for (const value of strings) {
      const lower = /effectif\s*>=\s*(\d+)/i.exec(value)
      const upper = /effectif\s*<=\s*(\d+)/i.exec(value)
      if (lower) min = Number(lower[1])
      if (upper) max = Number(upper[1])
    }
    return min !== undefined || max !== undefined ? { min, max } : null
  }

  /** Buckets fully contained in the [min, max] headcount interval. */
  private bucketsForInterval(min: number | undefined, max: number | undefined): string[] {
    const low = min ?? 0
    const high = max ?? Number.POSITIVE_INFINITY
    return (Object.entries(COMPANY_SIZE_BOUNDS) as [string, { min?: number; max?: number }][])
      .filter(([value]) => value !== 'other')
      .filter(([, bounds]) => (bounds.min ?? 0) >= low && (bounds.max ?? Number.POSITIVE_INFINITY) <= high)
      .map(([value]) => value)
  }

  private mapModifications(
    source: SourceVariant,
    operatorIdByName: Map<string, number>,
  ): VariantModification[] {
    const modifications: VariantModification[] = []
    const pushText = (field: ModifiableField, raw: string | undefined): void => {
      const value = raw?.trim()
      if (value) modifications.push({ field, newValue: value })
    }

    pushText('montant', source['Montant du dispositif'])
    pushText('duree', source['Durée du dispositif'])
    pushText('urlSource', source.url)
    pushText('eligibiliteEffectif', source['Eligibilité taille'])
    for (const criterion of source["autres critères d'éligibilité"] ?? []) {
      pushText('autresCriteres', criterion)
    }

    const contactName = source['opérateur de contact']
    const contactId = contactName ? operatorIdByName.get(contactName) : undefined
    if (contactId !== undefined) {
      modifications.push({ field: 'contactOperateur', contactOperator: contactId })
    }

    const otherIds = (source['autres opérateurs'] ?? [])
      .map((name) => operatorIdByName.get(name))
      .filter((id): id is number => id !== undefined)
    if (otherIds.length > 0) {
      modifications.push({ field: 'autresOperateurs', otherOperators: otherIds })
    }

    return modifications
  }
}
