import type { editorConfigFactory } from '@payloadcms/richtext-lexical'
import { convertMarkdownToLexical } from '@payloadcms/richtext-lexical'
import type { SourceProgram } from './types'
import { FrenchDateParser } from '@/utils/FrenchDateParser'

type AidType =
  | 'financement'
  | 'pret'
  | 'avantage-fiscal'
  | 'formation'
  | 'diagnostic-etude'

type CompanySize =
  | '0-9'
  | '10-19'
  | '20-49'
  | '50-249'
  | '250-499'
  | '500-4999'
  | '5000+'
  | 'other'

type ActivitySector =
  | 'all'
  | 'agriculture'
  | 'industrie'
  | 'tertiaire'
  | 'commerce'
  | 'artisanat'
  | 'tourisme'
  | 'other'
  | 'naf-code'

type EditorConfig = Awaited<ReturnType<typeof editorConfigFactory.default>>

interface CompanySizeMapping {
  sizes: CompanySize[]
  sizeOther: string | undefined
}

interface ActivitySectorMapping {
  sectors: ActivitySector[]
  sectorOther: string | undefined
}

type ContactMethod = 'email' | 'url' | 'advisor'

interface ContactMapping {
  contactMethods: ContactMethod[]
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

const COMPANY_SIZE_KEYWORDS: { value: CompanySize; matchers: RegExp[] }[] = [
  { value: '0-9', matchers: [/0\s*[àa-]\s*9/i, /\bTPE\b/i, /micro[\s-]?entreprise/i] },
  { value: '10-19', matchers: [/10\s*[àa-]\s*19/i] },
  { value: '20-49', matchers: [/20\s*[àa-]\s*49/i] },
  { value: '50-249', matchers: [/50\s*[àa-]\s*249/i, /\bPME\b/i] },
  { value: '250-499', matchers: [/250\s*[àa-]\s*499/i] },
  { value: '500-4999', matchers: [/500\s*[àa-]\s*4999/i] },
  { value: '5000+', matchers: [/[+5]\s*5000/i, /grandes?\s+entreprises?/i] },
]

const ACTIVITY_SECTOR_KEYWORDS: { value: ActivitySector; matchers: RegExp[] }[] = [
  { value: 'all', matchers: [/tous\s+secteurs/i, /toutes?\s+entreprises?/i] },
  { value: 'agriculture', matchers: [/agricult/i, /\bagri\b/i] },
  { value: 'industrie', matchers: [/industri/i] },
  { value: 'tertiaire', matchers: [/tertiaire/i, /service/i] },
  { value: 'commerce', matchers: [/commerce/i] },
  { value: 'artisanat', matchers: [/artisan/i] },
  { value: 'tourisme', matchers: [/tourism/i, /hôtel/i, /restaur/i] },
]

export class ProgramMapper {
  constructor(private readonly editorConfig: EditorConfig) {}

  map(program: SourceProgram, operatorIdByName: Map<string, number>) {
    const operatorId = operatorIdByName.get(program['opérateur de contact'])
    if (!operatorId) return null

    const otherOperatorIds = (program['autres opérateurs'] ?? [])
      .map((name) => operatorIdByName.get(name))
      .filter((id): id is number => id !== undefined)

    const aidType = this.mapAidType(program["nature de l'aide"])
    const eligibilityCondition = program["conditions d'éligibilité"]
    const { sizes, sizeOther } = this.mapCompanySizes(
      eligibilityCondition?.["taille de l'entreprise"] ?? [],
    )
    const { sectors, sectorOther } = this.mapActivitySectors(
      eligibilityCondition?.["secteur d'activité"] ?? [],
    )
    const geographicAreaFeedback = (eligibilityCondition?.['secteur géographique'] ?? [])
      .filter(Boolean)
      .join(' — ')
    const otherCriteria = [
      ...(eligibilityCondition?.["nombre d'années d'activité"] ?? []),
      ...(eligibilityCondition?.["autres critères d'éligibilité"] ?? []),
    ]
      .filter(Boolean)
      .map((value) => ({ value }))

    const contact = this.mapContact(program['contact question'])
    const amounts = this.mapAmountFields(aidType, program)
    const trimmedUrl = program.url?.trim()
    const hasValidUrl = Boolean(trimmedUrl)

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
      steps: (program.objectifs ?? []).map((obj) => ({
        description: obj.description,
        links: (obj.liens ?? []).map((lien) => ({
          url: lien.lien,
          linkLabel: lien.texte ?? '',
        })),
      })),
      contactMethods: contact.contactMethods,
      contactEmail: contact.contactEmail,
      contactPageUrl: contact.contactPageUrl,
      validityStart: FrenchDateParser.parse(program['début de validité']),
      validityEnd: FrenchDateParser.parse(program['fin de validité']),
      companySizes: sizes,
      companySizeOther: sizeOther,
      geographicAreaFeedback: geographicAreaFeedback || undefined,
      activitySectors: sectors,
      activitySectorOther: sectorOther,
      otherCriteria,
      workflowStatus: hasValidUrl ? ('publie' as const) : ('en-creation' as const),
      _status: hasValidUrl ? ('published' as const) : ('draft' as const),
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
    loanDuration: string
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
        return { loanAmount: program['montant du prêt'], loanDuration: program['durée du prêt'] }
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
        contactMethods: ['email'],
        contactEmail: trimmed.slice('mailto:'.length),
        contactPageUrl: undefined,
      }
    }
    if (/^https?:\/\//.test(trimmed)) {
      return {
        contactMethods: ['url'],
        contactEmail: undefined,
        contactPageUrl: trimmed,
      }
    }
    return { contactMethods: [], contactEmail: undefined, contactPageUrl: undefined }
  }

  private mapCompanySizes(values: string[]): CompanySizeMapping {
    const sizes = new Set<CompanySize>()
    const unmatched: string[] = []
    for (const value of values) {
      const matched = COMPANY_SIZE_KEYWORDS.filter(({ matchers }) =>
        matchers.some((re) => re.test(value)),
      )
      if (matched.length === 0) {
        unmatched.push(value)
      } else {
        for (const m of matched) sizes.add(m.value)
      }
    }
    if (unmatched.length > 0) sizes.add('other')
    return {
      sizes: [...sizes],
      sizeOther: unmatched.length > 0 ? unmatched.join(' — ') : undefined,
    }
  }

  private mapActivitySectors(values: string[]): ActivitySectorMapping {
    const sectors = new Set<ActivitySector>()
    const unmatched: string[] = []
    for (const value of values) {
      const matched = ACTIVITY_SECTOR_KEYWORDS.filter(({ matchers }) =>
        matchers.some((re) => re.test(value)),
      )
      if (matched.length === 0) {
        unmatched.push(value)
      } else {
        for (const m of matched) sectors.add(m.value)
      }
    }
    if (unmatched.length > 0) sectors.add('other')
    return {
      sectors: [...sectors],
      sectorOther: unmatched.length > 0 ? unmatched.join(' — ') : undefined,
    }
  }
}
