import type { CanonicalProgramInput } from '@tee-backoffice/canonical'
import type { Program } from '../../../../payload-types'
import { COMPANY_SIZE_BOUNDS } from '../canonicalMappings'
import type { ProgramRelations } from './ProgramRelations'

type VarianteInput = NonNullable<CanonicalProgramInput['variantes']>[number]
type PayloadVariant = NonNullable<Program['variants']>[number]
type PayloadCondition = NonNullable<PayloadVariant['conditions']>[number]
type PayloadModification = NonNullable<PayloadVariant['modifications']>[number]

/**
 * Canonical `variantes` → Payload `variants`. Headcount intervals become the size
 * buckets they fully contain, COG region codes become geographic area ids,
 * operator names become operator ids. A variant left without a condition or a
 * modification is dropped, matching the canonical "at least one of each" rule.
 */
export class CanonicalVariantToPayloadMapper {
  constructor(private readonly relations: ProgramRelations) {}

  map(variantes: CanonicalProgramInput['variantes'], warnings: string[]): PayloadVariant[] {
    return (variantes ?? [])
      .map((variante) => this.mapVariant(variante, warnings))
      .filter((variant): variant is PayloadVariant => variant !== undefined)
  }

  private mapVariant(variante: VarianteInput, warnings: string[]): PayloadVariant | undefined {
    const conditions = this.mapConditions(variante.conditions, warnings)
    const modifications = this.mapModifications(variante.modifications)
    if (conditions.length === 0 || modifications.length === 0) return undefined
    return { conditions, modifications }
  }

  private mapConditions(conditions: VarianteInput['conditions'], warnings: string[]): PayloadCondition[] {
    const rows: PayloadCondition[] = []

    const areaIds: number[] = []
    for (const code of conditions.regions ?? []) {
      const id = this.relations.areaByCogCode(code)?.id
      if (id === undefined) warnings.push(`zone ${code} inconnue du CMS (condition de variante ignorée)`)
      else areaIds.push(id)
    }
    if (areaIds.length > 0) {
      rows.push({ conditionType: 'geographicArea', geographicAreaValue: [...new Set(areaIds)] })
    }

    if (conditions.effectif) {
      const buckets = this.bucketsWithin(conditions.effectif.min, conditions.effectif.max)
      if (buckets.length > 0) rows.push({ conditionType: 'companySize', companySizeValue: buckets })
    }
    return rows
  }

  /** Size buckets fully contained in the [min, max] headcount interval. */
  private bucketsWithin(min: number | undefined, max: number | undefined): string[] {
    const low = min ?? 0
    const high = max ?? Number.POSITIVE_INFINITY
    return Object.entries(COMPANY_SIZE_BOUNDS)
      .filter(([, bounds]) => (bounds.min ?? 0) >= low && (bounds.max ?? Number.POSITIVE_INFINITY) <= high)
      .map(([bucket]) => bucket)
  }

  private mapModifications(modifications: VarianteInput['modifications']): PayloadModification[] {
    const rows: PayloadModification[] = []
    const pushText = (field: PayloadModification['field'], value: string | undefined): void => {
      const trimmed = value?.trim()
      if (trimmed) rows.push({ field, newValue: trimmed })
    }

    pushText('montant', modifications.montant?.valeur)
    pushText('duree', modifications.duree?.valeur)
    pushText('urlSource', modifications.url_source)
    for (const texte of modifications.eligibilite?.effectif?.texte ?? []) pushText('eligibiliteEffectif', texte)
    for (const texte of modifications.eligibilite?.autres_criteres?.texte ?? []) pushText('autresCriteres', texte)

    const contactName = modifications.operateurs?.contact?.nom
    const contactId = contactName ? this.relations.operatorId(contactName) : undefined
    if (contactId !== undefined) rows.push({ field: 'contactOperateur', contactOperator: contactId })

    const otherIds = (modifications.operateurs?.autres ?? [])
      .map((operateur) => this.relations.operatorId(operateur.nom))
      .filter((id): id is number => id !== undefined)
    if (otherIds.length > 0) rows.push({ field: 'autresOperateurs', otherOperators: otherIds })

    return rows
  }
}
