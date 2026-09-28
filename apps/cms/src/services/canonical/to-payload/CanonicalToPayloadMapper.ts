import type { RequiredDataFromCollectionSlug } from 'payload'
import type { CanonicalProgramInput, Theme, TypeAide } from '@tee-backoffice/canonical'
import type { Program } from '../../../../payload-types'
import type { NafSection } from '@/constants/nafSectionsOptions'
import { NAF_SECTIONS_OPTIONS } from '@/constants/nafSectionsOptions'
import type { CompanySizeBucket } from '@/constants/companySizeOptions'
import { UrlValidator } from '@/utils/UrlValidator'
import type { MarkdownToRichText } from '../rich-text/MarkdownToRichText'
import {
  AID_TYPE_TO_CANONICAL,
  COMPANY_SIZE_BOUNDS,
  DUREE_BY_AID_TYPE,
  MONTANT_BY_AID_TYPE,
  THEME_TO_CANONICAL,
} from '../canonicalMappings'
import { CanonicalVariantToPayloadMapper } from './CanonicalVariantToPayloadMapper'
import type { ProgramRelations } from './ProgramRelations'
import type { ResolvedGeographic } from './GeographicAreaResolver'

export type PayloadProgramData = RequiredDataFromCollectionSlug<'programs'>

export interface CanonicalToPayloadResult {
  data: PayloadProgramData
  /** Canonical data the Payload model cannot hold, reported instead of silently dropped. */
  warnings: string[]
}

type AidType = Program['aidType']
type EligibiliteInput = NonNullable<CanonicalProgramInput['eligibilite']>

const CANONICAL_TO_AID_TYPE = Object.fromEntries(
  Object.entries(AID_TYPE_TO_CANONICAL).map(([aidType, typeAide]) => [typeAide, aidType]),
) as Partial<Record<TypeAide, AidType>>

const CANONICAL_TO_THEME = Object.fromEntries(
  Object.entries(THEME_TO_CANONICAL).map(([theme, canonical]) => [canonical, theme]),
) as Record<Theme, NonNullable<Program['themes']>[number]>

/**
 * programs.json amount / duration labels accepted for each aid type, next to the
 * labels `ProgramCanonicalMapper` emits. Payload has one amount (and at most one
 * duration) field per aid type: a label outside this list (e.g. a financing
 * amount on a study) has no field to land in and is reported.
 */
const SOURCE_MONTANT_LABELS: Record<AidType, string[]> = {
  financement: ['montant du financement'],
  pret: ['montant du prêt'],
  'avantage-fiscal': ["montant de l'avantage fiscal"],
  formation: ["coût de l'accompagnement"],
  'diagnostic-etude': ["coût de l'accompagnement"],
}

const SOURCE_DUREE_LABELS: Partial<Record<AidType, string[]>> = {
  formation: ["durée de l'accompagnement"],
  'diagnostic-etude': ["durée de l'accompagnement"],
}

const ALL_NAF_SECTIONS: readonly NafSection[] = NAF_SECTIONS_OPTIONS.map((option) => option.value)

/**
 * Canonical program → Payload `programs` data, the inverse of
 * `ProgramCanonicalMapper`. It is how upstream data (read by `TeeImporter`)
 * enters the CMS, so the raw upstream format is parsed in one place only.
 * Names and codes are resolved to relation ids through `ProgramRelations`.
 *
 * A program is published only when its url, contact page url and every step
 * link are valid; otherwise it stays `en-creation` so editors can spot and fix it.
 */
export class CanonicalToPayloadMapper {
  private readonly variants: CanonicalVariantToPayloadMapper

  constructor(
    private readonly richText: MarkdownToRichText,
    private readonly relations: ProgramRelations,
  ) {
    this.variants = new CanonicalVariantToPayloadMapper(relations)
  }

  map(input: CanonicalProgramInput): CanonicalToPayloadResult {
    const warnings: string[] = []

    const aidType = input.types_aides[0] ? CANONICAL_TO_AID_TYPE[input.types_aides[0]] : undefined
    if (!aidType) throw new Error(`type d'aide non géré : ${input.types_aides.join(', ') || 'aucun'}`)

    const operator = this.relations.operatorId(input.operateurs.contact.nom)
    if (operator === undefined) throw new Error(`opérateur introuvable : ${input.operateurs.contact.nom}`)

    const url = input.url_source?.trim()
    const steps = this.mapSteps(input, warnings)
    const contact = this.mapContact(input)
    const canPublish =
      Boolean(url) &&
      UrlValidator.isValid(url) &&
      UrlValidator.isValid(contact.contactPageUrl) &&
      steps.every((step) => (step.links ?? []).every((link) => UrlValidator.isValid(link.url)))

    const data: PayloadProgramData = {
      canonicalId: input.id,
      slug: input.slug,
      title: input.titre,
      promise: input.promesse ?? '',
      aidType,
      description: this.richText.convert(input.description),
      additionalInfo: input.description_longue ? this.richText.convert(input.description_longue) : undefined,
      operator,
      otherOperators: this.operatorIds(input.operateurs.autres),
      // Required on publish only: a program without url is saved as a draft.
      url: url ?? '',
      ...this.mapAmounts(input, aidType, warnings),
      steps,
      ...contact,
      validityStart: input.date_ouverture,
      validityEnd: input.date_cloture,
      ...this.mapCompanySize(input.eligibilite),
      ...this.mapGeography(input.eligibilite),
      ...this.mapActivitySector(input.eligibilite),
      otherCriteria: this.mapOtherCriteria(input.eligibilite),
      themes: (input.themes ?? []).map((theme) => CANONICAL_TO_THEME[theme]),
      variants: this.variants.map(input.variantes, warnings),
      temporarilyUnavailable: input.statut_dispositif === 'temporairement_indisponible',
      workflowStatus: canPublish ? 'publie' : 'en-creation',
      _status: canPublish ? 'published' : 'draft',
      metaTitle: input.meta?.titre,
      metaDescription: input.meta?.description,
    }

    if (input.eligibilite?.categorie_legale) {
      warnings.push('restriction de catégorie légale (micro-entreprises) sans champ Payload')
    }
    return { data, warnings }
  }

  private operatorIds(operateurs: { nom: string }[] | undefined): number[] | undefined {
    const ids = (operateurs ?? [])
      .map((operateur) => this.relations.operatorId(operateur.nom))
      .filter((id): id is number => id !== undefined)
    return ids.length > 0 ? ids : undefined
  }

  private mapSteps(input: CanonicalProgramInput, warnings: string[]): NonNullable<PayloadProgramData['steps']> {
    return (input.etapes_activation ?? []).map((etape) => {
      const links = (etape.liens ?? []).flatMap((lien) => {
        if ('url' in lien) return [{ linkLabel: lien.texte, url: lien.url }]
        warnings.push("lien d'étape vers le formulaire conseiller sans équivalent Payload")
        return []
      })
      return { description: this.richText.convert(etape.description), links }
    })
  }

  private mapAmounts(
    input: CanonicalProgramInput,
    aidType: AidType,
    warnings: string[],
  ): Partial<PayloadProgramData> {
    const amounts: Partial<PayloadProgramData> = {}

    const montant = MONTANT_BY_AID_TYPE[aidType]
    if (input.montant) {
      if (this.labelMatches(input.montant.type, [...SOURCE_MONTANT_LABELS[aidType], montant.label])) {
        Object.assign(amounts, { [montant.field]: input.montant.valeur })
      } else {
        warnings.push(`montant « ${input.montant.type} » sans champ pour le type ${aidType}`)
      }
    }

    const duree = DUREE_BY_AID_TYPE[aidType]
    if (input.duree) {
      if (duree && this.labelMatches(input.duree.type, [...(SOURCE_DUREE_LABELS[aidType] ?? []), duree.label])) {
        Object.assign(amounts, { [duree.field]: input.duree.valeur })
      } else {
        warnings.push(`durée « ${input.duree.type} » sans champ pour le type ${aidType}`)
      }
    }
    return amounts
  }

  private labelMatches(label: string, accepted: string[]): boolean {
    const normalized = label.trim().toLowerCase()
    return accepted.some((candidate) => candidate.toLowerCase() === normalized)
  }

  private mapContact(input: CanonicalProgramInput): Pick<Partial<PayloadProgramData>, 'contactMethod' | 'contactEmail' | 'contactPageUrl'> {
    const contact = input.contact_question
    switch (contact?.type) {
      case 'email':
        return { contactMethod: 'email', contactEmail: contact.valeur }
      case 'url':
        return { contactMethod: 'url', contactPageUrl: contact.valeur }
      case 'conseiller_entreprise':
        return { contactMethod: 'advisor' }
      default:
        return {}
    }
  }

  /** Follows the structured bounds (what TEE uses for eligibility), not the free text. */
  private mapCompanySize(eligibilite: EligibiliteInput | undefined): Partial<PayloadProgramData> {
    const structure = eligibilite?.effectif?.structure
    if (!structure || (structure.min === undefined && structure.max === undefined)) {
      return { companySize: 'all', companySizeMin: null, companySizeMax: null }
    }
    const bucket = (Object.entries(COMPANY_SIZE_BOUNDS) as [CompanySizeBucket, { min?: number; max?: number }][]).find(
      ([, bounds]) => bounds.min === structure.min && bounds.max === structure.max,
    )?.[0]
    if (bucket) return { companySize: bucket, companySizeMin: null, companySizeMax: null }
    return { companySize: 'specific', companySizeMin: structure.min ?? null, companySizeMax: structure.max ?? null }
  }

  private mapGeography(eligibilite: EligibiliteInput | undefined): Partial<PayloadProgramData> {
    const secteur = eligibilite?.secteur_geographique
    // Free text first: it also names departments, which the structure never carries.
    const resolved = secteur?.texte?.length
      ? this.relations.resolveGeography(secteur.texte)
      : this.resolveGeographyCodes(secteur?.structure?.inclusions ?? [])
    return {
      geographicCoverage: resolved.geographicCoverage ?? null,
      geographicAreas: resolved.geographicAreas ?? [],
      // null rather than undefined so a stale feedback is cleared on update.
      geographicAreaFeedback: resolved.geographicAreaFeedback ?? null,
    }
  }

  private resolveGeographyCodes(codes: string[]): ResolvedGeographic {
    const ids = codes
      .map((code) => this.relations.areaIdByCogCode(code))
      .filter((id): id is number => id !== undefined)
    if (ids.length === 0) return {}
    const coverage = codes.every((code) => code.startsWith('DEP-')) ? 'departemental' : 'regional'
    return { geographicCoverage: coverage, geographicAreas: ids }
  }

  private mapActivitySector(eligibilite: EligibiliteInput | undefined): Partial<PayloadProgramData> {
    const secteur = eligibilite?.secteur_activite
    const inclusions = secteur?.structure?.inclusions ?? []
    const sections = inclusions.filter((code): code is NafSection => ALL_NAF_SECTIONS.includes(code as NafSection))
    const nafCode = inclusions.find((code) => !ALL_NAF_SECTIONS.includes(code as NafSection))
    const empty = { nafSections: [], activitySectorDescription: null, nafCode: null }

    if (!nafCode && sections.length > 0) {
      return sections.length === ALL_NAF_SECTIONS.length
        ? { activitySector: 'all', ...empty }
        : { activitySector: 'naf-sections', ...empty, nafSections: sections }
    }
    const description = secteur?.texte?.join(' / ')
    if (!nafCode && !description) return { activitySector: 'all', ...empty }
    return {
      activitySector: 'specific',
      ...empty,
      activitySectorDescription: description ?? null,
      nafCode: nafCode ?? null,
    }
  }

  /** Seniority has no Payload field of its own: it joins the other criteria, as editors expect. */
  private mapOtherCriteria(eligibilite: EligibiliteInput | undefined): { value: string }[] {
    return [...(eligibilite?.anciennete?.texte ?? []), ...(eligibilite?.autres_criteres?.texte ?? [])]
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => ({ value }))
  }
}
