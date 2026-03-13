import type { editorConfigFactory } from '@payloadcms/richtext-lexical'
import { convertMarkdownToLexical } from '@payloadcms/richtext-lexical'
import type { SourceProgram } from './types'
import { FrenchDateParser } from '@/utils/FrenchDateParser'
import { ValueArrayConverter } from '@/utils/ValueArrayConverter'

type AidType = 'etude' | 'financement' | 'formation' | 'pret' | 'avantage-fiscal'
type EditorConfig = Awaited<ReturnType<typeof editorConfigFactory.default>>

export class ProgramMapper {
  private static readonly AID_TYPE_MAP: Record<string, AidType> = {
    étude: 'etude',
    financement: 'financement',
    formation: 'formation',
    prêt: 'pret',
    'avantage fiscal': 'avantage-fiscal',
  }

  constructor(private readonly editorConfig: EditorConfig) {}

  map(program: SourceProgram, operatorIdByName: Map<string, number>) {
    const operatorId = operatorIdByName.get(program['opérateur de contact'])
    if (!operatorId) return null

    const otherOperatorIds = (program['autres opérateurs'] ?? [])
      .map((name) => operatorIdByName.get(name))
      .filter((id): id is number => id !== undefined)

    const eligibilityCondition = program["conditions d'éligibilité"]
    const eligibilityData = program.eligibilityData

    return {
      slug: program.id,
      title: program.titre,
      promise: program.promesse,
      aidType: this.mapAidType(program["nature de l'aide"]),
      description: this.toRichText(program.description.replaceAll(/[\\\n]+/g, '\n\n')),
      longDescription: program['description longue']
        ? this.toRichText(program['description longue'])
        : undefined,
      operator: operatorId,
      otherOperators: otherOperatorIds.length > 0 ? otherOperatorIds : undefined,
      illustration: program.illustration,
      contactUrl: program['contact question'],
      url: program.url,
      validityStart: FrenchDateParser.parse(program['début de validité']),
      validityEnd: FrenchDateParser.parse(program['fin de validité']),
      temporarilyUnavailable: program['aide temporairement indisponible'] === 'oui',
      fundingAmount: program['montant du financement'],
      accompanyingCost: program["coût de l'accompagnement"],
      accompanyingDuration: program["durée de l'accompagnement"],
      loanAmount: program['montant du prêt'],
      loanDuration: program['durée du prêt'],
      taxBenefitAmount: program["montant de l'avantage fiscal"],
      selfActivatable: program['activable en autonomie'] as 'oui' | 'non' | undefined,
      objectives: (program.objectifs ?? []).map((obj) => ({
        description: obj.description,
        links: (obj.liens ?? []).map((lien) => ({ url: lien.lien, label: lien.texte ?? '' })),
      })),
      eligibilityConditions: {
        companySize: ValueArrayConverter.from(eligibilityCondition?.['taille de l\'entreprise']),
        geographicArea: ValueArrayConverter.from(eligibilityCondition?.['secteur géographique']),
        activitySector: ValueArrayConverter.from(eligibilityCondition?.['secteur d\'activité']),
        activityYears: ValueArrayConverter.from(eligibilityCondition?.["nombre d'années d'activité"]),
        otherCriteria: ValueArrayConverter.from(eligibilityCondition?.["autres critères d'éligibilité"]),
      },
      eligibilityData: {
        company: {
          allowedNafSections: ValueArrayConverter.from(eligibilityData?.company?.allowedNafSections),
          minEmployees: eligibilityData?.company?.minEmployees !== undefined
            ? Number(eligibilityData.company.minEmployees)
            : undefined,
          maxEmployees: eligibilityData?.company?.maxEmployees !== undefined
            ? Number(eligibilityData.company.maxEmployees)
            : undefined,
          excludeMicroentrepreneur: eligibilityData?.company?.excludeMicroentrepreneur ?? false,
        },
        validityStart: FrenchDateParser.parse(eligibilityData?.validity?.start),
        validityEnd: FrenchDateParser.parse(eligibilityData?.validity?.end),
        priorityObjectives: ValueArrayConverter.from(eligibilityData?.priorityObjectives),
      },
      metaTitle: program.metaTitre,
      metaDescription: program.metaDescription,
    }
  }

  private toRichText(markdown: string) {
    return convertMarkdownToLexical({ editorConfig: this.editorConfig, markdown })
  }

  private mapAidType(raw: string): AidType {
    return ProgramMapper.AID_TYPE_MAP[raw] ?? (raw as AidType)
  }
}
