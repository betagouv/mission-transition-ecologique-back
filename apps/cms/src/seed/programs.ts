import type { Payload } from 'payload'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import {
  convertMarkdownToLexical,
  editorConfigFactory,
} from '@payloadcms/richtext-lexical'

// ---------------------------------------------------------------------------
// Types for the source JSON
// ---------------------------------------------------------------------------

interface SourceObjective {
  description: string
  liens?: Array<{ lien: string; texte?: string }>
}

interface SourceEligibilityConditions {
  'taille de l\'entreprise'?: string[]
  'secteur géographique'?: string[]
  'secteur d\'activité'?: string[]
  "nombre d'années d'activité"?: string[]
  "autres critères d'éligibilité"?: string[]
}

interface SourceEligibilityData {
  company?: {
    allowedNafSections?: string[]
    minEmployees?: string | number
    maxEmployees?: string | number
    excludeMicroentrepreneur?: boolean
  }
  validity?: {
    start?: string
    end?: string
  }
  priorityObjectives?: string[]
}

interface SourceProgram {
  id: string
  titre: string
  promesse: string
  "nature de l'aide": string
  description: string
  'description longue'?: string
  'opérateur de contact': string
  'autres opérateurs'?: string[]
  illustration?: string
  'contact question': string
  url?: string
  'début de validité'?: string
  'fin de validité'?: string
  'aide temporairement indisponible'?: string
  'montant du financement'?: string
  "coût de l'accompagnement"?: string
  "durée de l'accompagnement"?: string
  'montant du prêt'?: string
  'durée du prêt'?: string
  "montant de l'avantage fiscal"?: string
  'activable en autonomie'?: string
  objectifs?: SourceObjective[]
  "conditions d'éligibilité"?: SourceEligibilityConditions
  eligibilityData?: SourceEligibilityData
  metaTitre?: string
  metaDescription?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert DD/MM/YYYY to an ISO 8601 string (YYYY-MM-DD).
 * Returns undefined if the input is falsy or unparseable.
 */
function parseFrenchDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const parts = raw.trim().split('/')
  if (parts.length !== 3) return undefined
  const [day, month, year] = parts
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}


type AidType = 'etude' | 'financement' | 'formation' | 'pret' | 'avantage-fiscal'

/**
 * Map JSON "nature de l'aide" to Payload select value.
 */
function mapAidType(raw: string): AidType {
  const mapping: Record<string, AidType> = {
    étude: 'etude',
    financement: 'financement',
    formation: 'formation',
    prêt: 'pret',
    'avantage fiscal': 'avantage-fiscal',
  }
  return mapping[raw] ?? (raw as AidType)
}

/**
 * Slugify a string for use as an operator slug.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Convert an array of strings to Payload array-of-{value} format.
 */
function toValueArray(items: string[] | undefined): Array<{ value: string }> {
  if (!items || items.length === 0) return []
  return items.map((v) => ({ value: v }))
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

export async function seedPrograms(payload: Payload): Promise<void> {
  const dirname = fileURLToPath(new URL('.', import.meta.url))
  const programsPath = resolve(dirname, '../../../../docs/sources/programs.json')

  const editorConfig = await editorConfigFactory.default({ config: payload.config })

  payload.logger.info('Reading programs.json...')
  const raw = readFileSync(programsPath, 'utf-8')
  const programs: SourceProgram[] = JSON.parse(raw) as SourceProgram[]
  payload.logger.info(`Found ${programs.length.toString()} programs in source file.`)

  // -------------------------------------------------------------------------
  // Step 1: Collect and deduplicate all operator names
  // -------------------------------------------------------------------------
  const operatorNamesSet = new Set<string>()
  for (const program of programs) {
    if (program['opérateur de contact']) {
      operatorNamesSet.add(program['opérateur de contact'])
    }
    for (const other of program['autres opérateurs'] ?? []) {
      operatorNamesSet.add(other)
    }
  }

  payload.logger.info(`Found ${operatorNamesSet.size.toString()} unique operators. Upserting...`)

  // -------------------------------------------------------------------------
  // Step 2: Upsert operators and build name → ID map
  // -------------------------------------------------------------------------
  const operatorIdByName = new Map<string, number>()

  for (const name of operatorNamesSet) {
    const slug = slugify(name)

    // Check if already exists
    const existing = await payload.find({
      collection: 'operators',
      where: { slug: { equals: slug } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      const doc = existing.docs[0]
      if (doc?.id !== undefined) {
        operatorIdByName.set(name, doc.id)
      }
    } else {
      const created = await payload.create({
        collection: 'operators',
        data: { name, slug },
      })
      operatorIdByName.set(name, created.id)
    }
  }

  payload.logger.info(`Operators ready. Importing ${programs.length.toString()} programs...`)

  // -------------------------------------------------------------------------
  // Step 3: Upsert programs
  // -------------------------------------------------------------------------
  let created = 0
  let updated = 0
  let errors = 0
  for (const program of programs) {
    try {
      const operatorId = operatorIdByName.get(program['opérateur de contact'])
      if (!operatorId) {
        payload.logger.warn(`Operator not found for program "${program.id}" — skipping.`)
        errors++
        continue
      }

      const otherOperatorIds = (program['autres opérateurs'] ?? [])
        .map((name) => operatorIdByName.get(name))
        .filter((id): id is number => id !== undefined)

      const eligibilityCondition = program["conditions d'éligibilité"]
      const eligibilityData = program.eligibilityData

      const data = {
        slug: program.id,
        title: program.titre,
        promise: program.promesse,
        aidType: mapAidType(program["nature de l'aide"]),
        description: convertMarkdownToLexical({ editorConfig, markdown: program.description.replaceAll(/[\\\n]+/g, '\n\n') }),
        longDescription: program['description longue']
          ? convertMarkdownToLexical({ editorConfig, markdown: program['description longue'] })
          : undefined,
        operator: operatorId,
        otherOperators: otherOperatorIds.length > 0 ? otherOperatorIds : undefined,
        illustration: program.illustration,
        contactUrl: program['contact question'],
        url: program.url,
        validityStart: parseFrenchDate(program['début de validité']),
        validityEnd: parseFrenchDate(program['fin de validité']),
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
          links: (obj.liens ?? []).map((lien) => ({
            url: lien.lien,
            label: lien.texte ?? '',
          })),
        })),
        eligibilityConditions: {
          companySize: toValueArray(eligibilityCondition?.['taille de l\'entreprise']),
          geographicArea: toValueArray(eligibilityCondition?.['secteur géographique']),
          activitySector: toValueArray(eligibilityCondition?.['secteur d\'activité']),
          activityYears: toValueArray(eligibilityCondition?.["nombre d'années d'activité"]),
          otherCriteria: toValueArray(eligibilityCondition?.["autres critères d'éligibilité"]),
        },
        eligibilityData: {
          company: {
            allowedNafSections: toValueArray(eligibilityData?.company?.allowedNafSections),
            minEmployees: eligibilityData?.company?.minEmployees !== undefined
              ? Number(eligibilityData.company.minEmployees)
              : undefined,
            maxEmployees: eligibilityData?.company?.maxEmployees !== undefined
              ? Number(eligibilityData.company.maxEmployees)
              : undefined,
            excludeMicroentrepreneur: eligibilityData?.company?.excludeMicroentrepreneur ?? false,
          },
          validityStart: parseFrenchDate(eligibilityData?.validity?.start),
          validityEnd: parseFrenchDate(eligibilityData?.validity?.end),
          priorityObjectives: toValueArray(eligibilityData?.priorityObjectives),
        },
        metaTitle: program.metaTitre,
        metaDescription: program.metaDescription,
      }

      // Check if program already exists by slug
      const existing = await payload.find({
        collection: 'programs',
        where: { slug: { equals: program.id } },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        const doc = existing.docs[0]
        if (doc?.id !== undefined) {
          await payload.update({
            collection: 'programs',
            id: doc.id,
            data,
          })
          updated++
        }
      } else {
        await payload.create({
          collection: 'programs',
          data,
        })
        created++
      }
    } catch (err) {
      payload.logger.error(`Error importing program "${program.id}": ${String(err)}`)
      errors++
    }
  }

  payload.logger.info(
    `Seed complete — ${created.toString()} created, ${updated.toString()} updated, ${errors.toString()} errors.`,
  )
}
