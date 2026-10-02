import type { RequiredDataFromCollectionSlug } from 'payload'
import { COG_FRANCE, type CanonicalProgramInput, type TypeAide } from '@tee-backoffice/canonical'
import { UpstreamAmountLabels } from '@tee-backoffice/format-adapters'
import type { Program } from '../../../../payload-types'
import type { NafSection } from '@/constants/nafSectionsOptions'
import { NAF_SECTIONS_OPTIONS } from '@/constants/nafSectionsOptions'
import type { CompanySizeBucket } from '@/constants/companySizeOptions'
import { UrlValidator } from '@/utils/UrlValidator'
import type { MarkdownToRichText } from '../rich-text/MarkdownToRichText'
import {
  AID_TYPE_TO_CANONICAL,
  CANONICAL_TO_THEME,
  COMPANY_SIZE_BOUNDS,
  DUREE_BY_AID_TYPE,
  MONTANT_BY_AID_TYPE,
} from '../canonicalMappings'
import { CanonicalVariantToPayloadMapper } from './CanonicalVariantToPayloadMapper'
import type { ProgramRelations } from './ProgramRelations'

export type PayloadProgramData = RequiredDataFromCollectionSlug<'programs'>

export interface CanonicalToPayloadResult {
  data: PayloadProgramData
  /** Canonical data the Payload model cannot hold, reported instead of silently dropped. */
  warnings: string[]
}

type AidType = Program['aidType']
type EligibiliteInput = NonNullable<CanonicalProgramInput['eligibilite']>
type GeographyData = Pick<PayloadProgramData, 'geographicCoverage' | 'geographicAreas' | 'geographicAreaFeedback'>
type ContactData = Pick<PayloadProgramData, 'contactMethod' | 'contactEmail' | 'contactPageUrl'>

const CANONICAL_TO_AID_TYPE = Object.fromEntries(
  Object.entries(AID_TYPE_TO_CANONICAL).map(([aidType, typeAide]) => [typeAide, aidType]),
) as Partial<Record<TypeAide, AidType>>

const ALL_NAF_SECTIONS: readonly NafSection[] = NAF_SECTIONS_OPTIONS.map((option) => option.value)

const AMOUNT_FIELDS = [...Object.values(MONTANT_BY_AID_TYPE), ...Object.values(DUREE_BY_AID_TYPE)].map(({ field }) => field)

/**
 * Canonical program → Payload `programs` data, the inverse of
 * `ProgramCanonicalMapper`. It is how upstream data (read by `TeeImporter`)
 * enters the CMS, so the raw upstream format is parsed in one place only.
 * Names and codes are resolved to relation ids through `ProgramRelations`.
 *
 * A program is published only when its url, contact page url and every step
 * link are valid; otherwise it stays `en-creation` so editors can spot and fix it.
 * A program upstream redirects (`remplace`) keeps that status and points at its
 * replacement, which must already be in the CMS.
 *
 * Every field upstream can carry is written, an absent one as `null` or `[]`: a
 * Payload `update` starts from the latest version, a pending editor draft
 * included, and would publish whatever that draft holds in a field left out.
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

    const typeAide = input.types_aides[0]
    const aidType = typeAide ? CANONICAL_TO_AID_TYPE[typeAide] : undefined
    if (!typeAide || !aidType) throw new Error(`type d'aide non géré : ${input.types_aides.join(', ') || 'aucun'}`)

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

    const replaced = input.statut_dispositif === 'remplace'
    const workflowStatus = replaced ? 'remplace' : canPublish ? 'publie' : 'en-creation'

    const data: PayloadProgramData = {
      canonicalId: input.id,
      slug: input.slug,
      title: input.titre,
      promise: input.promesse ?? '',
      aidType,
      description: this.richText.convert(input.description),
      additionalInfo: input.description_longue ? this.richText.convert(input.description_longue) : null,
      operator,
      otherOperators: this.operatorIds(input.operateurs.autres),
      // Required on publish only: a program without url is saved as a draft.
      url: url ?? '',
      ...this.mapAmounts(input, aidType, typeAide, warnings),
      steps,
      ...contact,
      validityStart: input.date_ouverture ?? null,
      validityEnd: input.date_cloture ?? null,
      ...this.mapCompanySize(input.eligibilite),
      openToPublicAdministration:
        input.eligibilite?.categorie_legale?.structure?.autorise?.includes('administration_publique') ?? false,
      ...this.mapGeography(input.eligibilite),
      ...this.mapActivitySector(input.eligibilite),
      otherCriteria: this.mapOtherCriteria(input.eligibilite),
      themes: (input.themes ?? []).map((theme) => CANONICAL_TO_THEME[theme]),
      variants: this.variants.map(input.variantes, warnings),
      temporarilyUnavailable: input.statut_dispositif === 'temporairement_indisponible',
      workflowStatus,
      replacedBy: replaced ? this.replacementId(input) : null,
      _status: workflowStatus === 'publie' ? 'published' : 'draft',
      metaTitle: input.meta?.titre ?? null,
      metaDescription: input.meta?.description ?? null,
    }

    if (input.eligibilite?.categorie_legale?.structure?.interdit?.length) {
      warnings.push('restriction de catégorie légale (micro-entreprises) sans champ Payload')
    }
    return { data, warnings }
  }

  private replacementId(input: CanonicalProgramInput): number {
    const id = input.remplace_par ? this.relations.programIdByCanonicalId(input.remplace_par) : undefined
    if (id === undefined) throw new Error('dispositif remplaçant introuvable dans le CMS')
    return id
  }

  private operatorIds(operateurs: { nom: string }[] | undefined): number[] {
    return (operateurs ?? [])
      .map((operateur) => this.relations.operatorId(operateur.nom))
      .filter((id): id is number => id !== undefined)
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

  /**
   * Payload has one amount (and at most one duration) field per aid type. It
   * takes the label `ProgramCanonicalMapper` emits or an upstream one; any other
   * label (e.g. a financing amount on a study) has no field and is reported.
   * The fields of the other aid types are emptied.
   */
  private mapAmounts(
    input: CanonicalProgramInput,
    aidType: AidType,
    typeAide: TypeAide,
    warnings: string[],
  ): Partial<PayloadProgramData> {
    const amounts: Partial<PayloadProgramData> = Object.fromEntries(AMOUNT_FIELDS.map((field) => [field, null]))

    const montant = MONTANT_BY_AID_TYPE[aidType]
    if (input.montant) {
      if (this.labelMatches(input.montant.type, [...UpstreamAmountLabels.montantLabels(typeAide), montant.label])) {
        Object.assign(amounts, { [montant.field]: input.montant.valeur })
      } else {
        warnings.push(`montant « ${input.montant.type} » sans champ pour le type ${aidType}`)
      }
    }

    const duree = DUREE_BY_AID_TYPE[aidType]
    if (input.duree) {
      if (duree && this.labelMatches(input.duree.type, [...UpstreamAmountLabels.dureeLabels(typeAide), duree.label])) {
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

  private mapContact(input: CanonicalProgramInput): ContactData {
    const empty: ContactData = { contactMethod: null, contactEmail: null, contactPageUrl: null }
    const contact = input.contact_question
    switch (contact?.type) {
      case 'email':
        return { ...empty, contactMethod: 'email', contactEmail: contact.valeur }
      case 'url':
        return { ...empty, contactMethod: 'url', contactPageUrl: contact.valeur }
      case 'conseiller_entreprise':
        return { ...empty, contactMethod: 'advisor' }
      default:
        return empty
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

  /** From the COG codes only: the free text is display wording, kept as feedback when nothing else is known. */
  private mapGeography(eligibilite: EligibiliteInput | undefined): GeographyData {
    const secteur = eligibilite?.secteur_geographique
    const codes = secteur?.structure?.inclusions ?? []
    if (codes.length > 0) return this.geographyFromCodes(codes)
    const texte = (secteur?.texte ?? []).join(', ')
    return { geographicCoverage: null, geographicAreas: [], geographicAreaFeedback: texte || null }
  }

  /**
   * `PAYS-99100` means national. Regions win over their own departments: a
   * department of a listed region is dropped, already covered. What is left is
   * regional, departmental, or both levels when a department lies outside the
   * listed regions. Codes unknown to the CMS go to the feedback.
   */
  private geographyFromCodes(codes: string[]): GeographyData {
    if (codes.includes(COG_FRANCE)) {
      return { geographicCoverage: 'national', geographicAreas: [], geographicAreaFeedback: null }
    }
    const isDepartment = (code: string) => code.startsWith('DEP-')
    const regionIds = new Set(
      codes.filter((code) => !isDepartment(code)).flatMap((code) => this.relations.areaByCogCode(code)?.id ?? []),
    )
    const geographicAreas: number[] = []
    const unknown: string[] = []
    let departments = 0
    for (const code of codes) {
      const area = this.relations.areaByCogCode(code)
      if (!area) {
        unknown.push(code)
      } else if (!isDepartment(code)) {
        geographicAreas.push(area.id)
      } else if (area.parentId === undefined || !regionIds.has(area.parentId)) {
        geographicAreas.push(area.id)
        departments += 1
      }
    }
    const regions = geographicAreas.length - departments
    let geographicCoverage: GeographyData['geographicCoverage'] = 'regional'
    if (departments > 0) geographicCoverage = regions > 0 ? 'regional-departemental' : 'departemental'
    return {
      geographicCoverage,
      geographicAreas,
      geographicAreaFeedback: unknown.length > 0 ? unknown.join(', ') : null,
    }
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
