import type { editorConfigFactory } from '@payloadcms/richtext-lexical'
import { convertMarkdownToLexical } from '@payloadcms/richtext-lexical'
import type { SourceEligibilityCompany, SourceProgram } from './types'
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

// Source `priorityObjectives` carry the Payload theme values verbatim (EN).
const PROGRAM_THEMES = [
  'energy',
  'waste',
  'mobility',
  'environmental',
  'building',
  'water',
  'eco-design',
  'rh',
  'biodiversite',
] as const
type ProgramTheme = (typeof PROGRAM_THEMES)[number]

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

const SIZE_BUCKETS: { value: CompanySize; min: number; max?: number }[] = [
  { value: '0-9', min: 0, max: 9 },
  { value: '10-19', min: 10, max: 19 },
  { value: '20-49', min: 20, max: 49 },
  { value: '50-249', min: 50, max: 249 },
  { value: '250-499', min: 250, max: 499 },
  { value: '500-4999', min: 500, max: 4999 },
  { value: '5000+', min: 5000 },
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
    const { sizes, sizeOther } = this.mapCompanySizes(program.eligibilityData?.company)
    const { sectors, sectorOther } = this.mapActivitySectors(
      eligibilityCondition?.["secteur d'activité"] ?? [],
    )
    // Verbatim displayed bullets, preserved per source category so the export
    // round-trips `conditions d'éligibilité` exactly. The structured selects
    // (sizes, sectors, geographicAreas) feed `eligibilityData` independently.
    const sizeConditions = this.toCriteria(eligibilityCondition?.["taille de l'entreprise"])
    const geographicConditions = this.toCriteria(eligibilityCondition?.['secteur géographique'])
    const sectorConditions = this.toCriteria(eligibilityCondition?.["secteur d'activité"])
    const seniorityConditions = this.toCriteria(eligibilityCondition?.["nombre d'années d'activité"])
    const otherCriteria = this.toCriteria(eligibilityCondition?.["autres critères d'éligibilité"])

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
      // Thématiques : copie directe des priorityObjectives source (mêmes valeurs EN
      // que le champ `themes` Payload). Sans ce mapping, programs_themes reste vide.
      themes: this.mapThemes(program.eligibilityData?.priorityObjectives),
      companySizes: sizes,
      companySizeOther: sizeOther,
      activitySectors: sectors,
      activitySectorOther: sectorOther,
      sizeConditions,
      geographicConditions,
      sectorConditions,
      seniorityConditions,
      otherCriteria,
      workflowStatus: hasValidUrl ? ('publie' as const) : ('en-creation' as const),
      _status: hasValidUrl ? ('published' as const) : ('draft' as const),
      metaTitle: program.metaTitre,
      metaDescription: program.metaDescription,
    }
  }

  /** Source bullets → Payload `{ value }[]`, preserved verbatim, blanks dropped. */
  private toCriteria(values: string[] | undefined): { value: string }[] {
    return (values ?? []).filter(Boolean).map((value) => ({ value }))
  }

  /** Keep only values that are valid Payload theme options (source values match). */
  private mapThemes(values: string[] | undefined): ProgramTheme[] | undefined {
    const themes = (values ?? []).filter((value): value is ProgramTheme =>
      (PROGRAM_THEMES as readonly string[]).includes(value),
    )
    return themes.length > 0 ? themes : undefined
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
    // Le tag historique « formulaire » = renvoi vers Conseillers-Entreprises.
    if (trimmed === 'formulaire') {
      return { contactMethods: ['advisor'], contactEmail: undefined, contactPageUrl: undefined }
    }
    return { contactMethods: [], contactEmail: undefined, contactPageUrl: undefined }
  }

  /**
   * Effectif depuis `eligibilityData.company` (source structurée). Si `[min, max]`
   * s'aligne sur des bornes de tranches, on sélectionne les tranches couvrantes ;
   * sinon « autre » + texte « De X à Y » (reparsé à l'export). Mapping exact.
   */
  private mapCompanySizes(company?: SourceEligibilityCompany): CompanySizeMapping {
    const min = this.toInt(company?.minEmployees)
    const max = this.toInt(company?.maxEmployees)
    if (min === undefined && max === undefined) return { sizes: [], sizeOther: undefined }

    const lo = min ?? 0
    const covering = SIZE_BUCKETS.filter(
      (b) => (max === undefined || b.min <= max) && (b.max === undefined || b.max >= lo),
    )
    const first = covering[0]
    const last = covering[covering.length - 1]
    const exact =
      first !== undefined &&
      first.min === lo &&
      (max === undefined ? last.max === undefined : last.max === max)
    if (exact) return { sizes: covering.map((b) => b.value), sizeOther: undefined }

    const text = max === undefined ? `À partir de ${lo}` : `De ${lo} à ${max}`
    return { sizes: ['other'], sizeOther: text }
  }

  private toInt(value: string | undefined): number | undefined {
    if (value === undefined) return undefined
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
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
