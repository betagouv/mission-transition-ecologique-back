import type { editorConfigFactory } from '@payloadcms/richtext-lexical'
import { convertMarkdownToLexical } from '@payloadcms/richtext-lexical'
import type { SourceProgram } from './types'
import type { GeographicAreaResolver } from './GeographicAreaResolver'
import { FrenchDateParser } from '@/utils/FrenchDateParser'
import { UrlValidator } from '@/utils/UrlValidator'
import type { NafSection } from '@/constants/nafSectionsOptions'
import { COMPANY_SIZE_BOUNDS } from '@/services/canonical/canonicalMappings'

type AidType =
  | 'financement'
  | 'pret'
  | 'avantage-fiscal'
  | 'formation'
  | 'diagnostic-etude'

type CompanySizeBucket =
  | '0-9'
  | '10-19'
  | '20-49'
  | '50-249'
  | '250-499'
  | '500-4999'
  | '5000+'

type CompanySize = 'all' | CompanySizeBucket | 'specific'

/** Coarse sectors recognised in the source free text (pre-NAF vocabulary). */
type SourceSector =
  | 'all'
  | 'agriculture'
  | 'industrie'
  | 'tertiaire'
  | 'commerce'
  | 'artisanat'
  | 'tourisme'

type ActivitySector = 'all' | 'naf-sections' | 'specific'

type EditorConfig = Awaited<ReturnType<typeof editorConfigFactory.default>>

interface CompanySizeMapping {
  companySize: CompanySize
  companySizeMin: number | undefined
  companySizeMax: number | undefined
}

interface ActivitySectorMapping {
  activitySector: ActivitySector
  nafSections: NafSection[]
  activitySectorDescription: string | undefined
  nafCode: string | undefined
}

/** Best-effort mapping of the coarse source sectors onto NAF sections. */
const SOURCE_SECTOR_TO_NAF: Partial<Record<SourceSector, NafSection[]>> = {
  agriculture: ['A'],
  industrie: ['C'],
  commerce: ['G'],
  tourisme: ['I'],
}

/** Coarse sectors with no clean NAF section: kept as a free-text description. */
const SOURCE_SECTOR_LEFTOVER_LABEL: Partial<Record<SourceSector, string>> = {
  tertiaire: 'Tertiaire',
  artisanat: 'Artisanat',
}

type ContactMethod = 'email' | 'url' | 'advisor'

interface ContactMapping {
  contactMethod: ContactMethod | undefined
  contactEmail: string | undefined
  contactPageUrl: string | undefined
}

const AID_TYPE_MAP: Record<string, AidType> = {
  étude: 'diagnostic-etude',
  financement: 'financement',
  formation: 'formation',
  prêt: 'pret',
  'avantage fiscal': 'avantage-fiscal',
}

const COMPANY_SIZE_KEYWORDS: { value: CompanySizeBucket; matchers: RegExp[] }[] = [
  { value: '0-9', matchers: [/0\s*[àa-]\s*9/i, /\bTPE\b/i, /micro[\s-]?entreprise/i] },
  { value: '10-19', matchers: [/10\s*[àa-]\s*19/i] },
  { value: '20-49', matchers: [/20\s*[àa-]\s*49/i] },
  { value: '50-249', matchers: [/50\s*[àa-]\s*249/i, /\bPME\b/i] },
  { value: '250-499', matchers: [/250\s*[àa-]\s*499/i] },
  { value: '500-4999', matchers: [/500\s*[àa-]\s*4999/i] },
  { value: '5000+', matchers: [/[+5]\s*5000/i, /grandes?\s+entreprises?/i] },
]

const ACTIVITY_SECTOR_KEYWORDS: { value: SourceSector; matchers: RegExp[] }[] = [
  { value: 'all', matchers: [/tous\s+secteurs/i, /toutes?\s+entreprises?/i] },
  { value: 'agriculture', matchers: [/agricult/i, /\bagri\b/i] },
  { value: 'industrie', matchers: [/industri/i] },
  { value: 'tertiaire', matchers: [/tertiaire/i, /service/i] },
  { value: 'commerce', matchers: [/commerce/i] },
  { value: 'artisanat', matchers: [/artisan/i] },
  { value: 'tourisme', matchers: [/tourism/i, /hôtel/i, /restaur/i] },
]

export class ProgramMapper {
  constructor(
    private readonly editorConfig: EditorConfig,
    private readonly geographicAreaResolver: GeographicAreaResolver,
  ) {}

  map(program: SourceProgram, operatorIdByName: Map<string, number>) {
    const operatorId = operatorIdByName.get(program['opérateur de contact'])
    if (!operatorId) return null

    const otherOperatorIds = (program['autres opérateurs'] ?? [])
      .map((name) => operatorIdByName.get(name))
      .filter((id): id is number => id !== undefined)

    const aidType = this.mapAidType(program["nature de l'aide"])
    const eligibilityCondition = program["conditions d'éligibilité"]
    const companySize = this.mapCompanySizes(
      eligibilityCondition?.["taille de l'entreprise"] ?? [],
    )
    const activitySector = this.mapActivitySectors(
      eligibilityCondition?.["secteur d'activité"] ?? [],
    )
    const geographic = this.geographicAreaResolver.resolve(
      eligibilityCondition?.['secteur géographique'],
    )
    const otherCriteria = [
      ...(eligibilityCondition?.["nombre d'années d'activité"] ?? []),
      ...(eligibilityCondition?.["autres critères d'éligibilité"] ?? []),
    ]
      .filter(Boolean)
      .map((value) => ({ value }))

    const contact = this.mapContact(program['contact question'])
    const amounts = this.mapAmountFields(aidType, program)
    const trimmedUrl = program.url?.trim()
    const steps = (program.objectifs ?? []).map((obj) => ({
      description: this.toRichText(obj.description),
      links: (obj.liens ?? []).map((lien) => ({
        linkLabel: lien.texte ?? '',
        url: lien.lien,
      })),
    }))

    // Publish only when the main url and every step link are valid; otherwise
    // keep the program in draft (en-creation) so editors can spot and fix it.
    const canPublish =
      Boolean(trimmedUrl) &&
      UrlValidator.isValid(trimmedUrl) &&
      steps.every((step) => step.links.every((link) => UrlValidator.isValid(link.url)))

    return {
      slug: program.id,
      title: program.titre,
      promise: program.promesse,
      aidType,
      description: this.toRichText(program.description),
      additionalInfo: program['description longue']
        ? this.toRichText(program['description longue'])
        : undefined,
      operator: operatorId,
      otherOperators: otherOperatorIds.length > 0 ? otherOperatorIds : undefined,
      url: trimmedUrl,
      ...amounts,
      steps,
      contactMethod: contact.contactMethod,
      contactEmail: contact.contactEmail,
      contactPageUrl: contact.contactPageUrl,
      validityStart: FrenchDateParser.parse(program['début de validité']),
      validityEnd: FrenchDateParser.parse(program['fin de validité']),
      companySize: companySize.companySize,
      companySizeMin: companySize.companySizeMin,
      companySizeMax: companySize.companySizeMax,
      geographicCoverage: geographic.geographicCoverage ?? null,
      geographicAreas: geographic.geographicAreas ?? [],
      // Pass null (not undefined) so a stale feedback is actually cleared on update.
      geographicAreaFeedback: geographic.geographicAreaFeedback ?? null,
      activitySector: activitySector.activitySector,
      nafSections: activitySector.nafSections,
      activitySectorDescription: activitySector.activitySectorDescription,
      nafCode: activitySector.nafCode,
      otherCriteria,
      workflowStatus: canPublish ? ('publie' as const) : ('en-creation' as const),
      _status: canPublish ? ('published' as const) : ('draft' as const),
      metaTitle: program.metaTitre,
      metaDescription: program.metaDescription,
    }
  }

  private toRichText(markdown: string) {
    return convertMarkdownToLexical({ editorConfig: this.editorConfig, markdown })
  }

  private mapAidType(raw: string): AidType {
    return AID_TYPE_MAP[raw] ?? (raw as AidType)
  }

  private mapAmountFields(aidType: AidType, program: SourceProgram): Partial<{
    fundingAmount: string
    loanAmount: string
    taxBenefitAmount: string
    formationRemainingCost: string
    formationDuration: string
    studyRemainingCost: string
    studyDuration: string
  }> {
    switch (aidType) {
      case 'financement':
        return { fundingAmount: program['montant du financement'] }
      case 'pret':
        return { loanAmount: program['montant du prêt'] }
      case 'avantage-fiscal':
        return { taxBenefitAmount: program["montant de l'avantage fiscal"] }
      case 'formation':
        return {
          formationRemainingCost: program["coût de l'accompagnement"],
          formationDuration: program["durée de l'accompagnement"],
        }
      case 'diagnostic-etude':
        return {
          studyRemainingCost: program["coût de l'accompagnement"],
          studyDuration: program["durée de l'accompagnement"],
        }
    }
  }

  private mapContact(contactQuestion: string): ContactMapping {
    const trimmed = contactQuestion.trim()
    if (trimmed.startsWith('mailto:')) {
      return {
        contactMethod: 'email',
        contactEmail: trimmed.slice('mailto:'.length),
        contactPageUrl: undefined,
      }
    }
    if (/^https?:\/\//.test(trimmed)) {
      return {
        contactMethod: 'url',
        contactEmail: undefined,
        contactPageUrl: trimmed,
      }
    }
    return { contactMethod: undefined, contactEmail: undefined, contactPageUrl: undefined }
  }

  private mapCompanySizes(values: string[]): CompanySizeMapping {
    const buckets = new Set<CompanySizeBucket>()
    for (const value of values) {
      for (const { value: bucket, matchers } of COMPANY_SIZE_KEYWORDS) {
        if (matchers.some((re) => re.test(value))) buckets.add(bucket)
      }
    }

    const matched = [...buckets]
    // No recognised bucket: leave the default (no constraint).
    if (matched.length === 0) {
      return { companySize: 'all', companySizeMin: undefined, companySizeMax: undefined }
    }

    // A single recognised bucket keeps its named option (bounds derived later).
    if (matched.length === 1) {
      return { companySize: matched[0], companySizeMin: undefined, companySizeMax: undefined }
    }

    // Several buckets collapse to one explicit interval (specific min/max).
    const bounds = matched.map((bucket) => COMPANY_SIZE_BOUNDS[bucket])
    const mins = bounds.map((b) => b.min).filter((m): m is number => m !== undefined)
    const min = mins.length > 0 ? Math.min(...mins) : undefined
    const hasOpenEnd = bounds.some((b) => b.max === undefined)
    const maxes = bounds.map((b) => b.max).filter((m): m is number => m !== undefined)
    const max = hasOpenEnd || maxes.length === 0 ? undefined : Math.max(...maxes)

    return { companySize: 'specific', companySizeMin: min, companySizeMax: max }
  }

  private mapActivitySectors(values: string[]): ActivitySectorMapping {
    const sources = new Set<SourceSector>()
    const unmatched: string[] = []
    for (const value of values) {
      const matched = ACTIVITY_SECTOR_KEYWORDS.filter(({ matchers }) =>
        matchers.some((re) => re.test(value)),
      )
      if (matched.length === 0) unmatched.push(value)
      else for (const m of matched) sources.add(m.value)
    }

    const nafSections = [
      ...new Set(
        [...sources].flatMap((sector) => SOURCE_SECTOR_TO_NAF[sector] ?? []),
      ),
    ]
    const leftovers = [
      ...[...sources]
        .map((sector) => SOURCE_SECTOR_LEFTOVER_LABEL[sector])
        .filter((label): label is string => label !== undefined),
      ...unmatched,
    ]

    // Prefer the structured NAF mapping; fall back to a free-text description.
    if (nafSections.length > 0) {
      return {
        activitySector: 'naf-sections',
        nafSections,
        activitySectorDescription: undefined,
        nafCode: undefined,
      }
    }
    if (leftovers.length > 0) {
      return {
        activitySector: 'specific',
        nafSections: [],
        activitySectorDescription: leftovers.join(' / '),
        nafCode: undefined,
      }
    }
    return {
      activitySector: 'all',
      nafSections: [],
      activitySectorDescription: undefined,
      nafCode: undefined,
    }
  }
}
