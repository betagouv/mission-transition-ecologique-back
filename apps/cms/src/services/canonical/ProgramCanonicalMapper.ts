import type {
  CanonicalProgramInput,
  ContactQuestion,
  Duree,
  EtapeActivation,
  Lien,
  Montant,
} from '@tee-backoffice/canonical'
import type { GeographicArea, Program } from '../../../payload-types'
import type { RichTextToMarkdown } from './rich-text/RichTextToMarkdown'
import { COMPANY_SIZE_TO_INTERVAL } from '@/constants/variantOptions'
import { clean, operatorName, toIsoDate } from './mapperHelpers'
import {
  ACTIVITY_SECTOR_LABELS,
  AID_TYPE_TO_CANONICAL,
  COMPANY_SIZE_BOUNDS,
  COMPANY_SIZE_LABELS,
  COVERAGE_TYPE_TO_COG_PREFIX,
  DUREE_BY_AID_TYPE,
  MONTANT_BY_AID_TYPE,
  NUMERIC_COMPANY_SIZE_COUNT,
  THEME_TO_CANONICAL,
  WORKFLOW_STATUS_TO_DISPOSITIF,
  WORKFLOW_STATUS_TO_EDITION,
} from './canonicalMappings'

// Eligibility built against the INPUT type: structure codes are plain strings
// here (NafCode/CogCode brands are applied by validation, not by the mapper).
type EligibiliteInput = NonNullable<CanonicalProgramInput['eligibilite']>

// Variants built against the INPUT type for the same reason (regions stay plain
// strings; brands are applied by validation, not by the mapper).
type VarianteInput = NonNullable<CanonicalProgramInput['variantes']>[number]
type VarianteConditionsInput = VarianteInput['conditions']
type VarianteModificationsInput = VarianteInput['modifications']
type VarianteRow = NonNullable<Program['variants']>[number]
type ConditionRow = NonNullable<VarianteRow['conditions']>[number]
type NumericCompanySize = Exclude<NonNullable<Program['companySizes']>[number], 'other'>

/**
 * Transforms a Payload `Program` into a raw `CanonicalProgramInput`, ready to be
 * validated by `CanonicalProgramValidator`. Validation is intentionally NOT done
 * here: this class only restructures and relabels data. Relations (`operator`,
 * `otherOperators`, `geographicAreas`, `replacedBy`) must be populated
 * (`depth >= 1`). Optional relations left unpopulated are omitted rather than
 * guessed; a missing required `operator`, however, is emitted as an empty
 * contact name on purpose, so the resulting canonical fails validation loudly
 * instead of silently fabricating a value.
 */
export class ProgramCanonicalMapper {
  constructor(private readonly markdown: RichTextToMarkdown) {}

  map(program: Program): CanonicalProgramInput {
    return {
      ...this.mapIdentite(program),
      ...this.mapContenu(program),
      ...this.mapAide(program),
      eligibilite: this.mapEligibilite(program),
      themes: this.mapThemes(program),
      variantes: this.mapVariantes(program),
    }
  }

  private mapIdentite(program: Program): Pick<
    CanonicalProgramInput,
    'id' | 'slug' | 'source' | 'date_mise_a_jour'
  > {
    return {
      id: program.canonicalId ?? '',
      slug: program.slug,
      source: 'INTERNE',
      date_mise_a_jour: program.updatedAt,
    }
  }

  private mapContenu(program: Program): Pick<
    CanonicalProgramInput,
    'titre' | 'promesse' | 'description' | 'description_longue' | 'meta'
  > {
    const descriptionLongue = this.markdown.convert(program.additionalInfo)
    return {
      titre: program.title,
      promesse: clean(program.promise),
      description: this.markdown.convert(program.description),
      description_longue: descriptionLongue.length > 0 ? descriptionLongue : undefined,
      meta: this.mapMeta(program),
    }
  }

  private mapMeta(program: Program): CanonicalProgramInput['meta'] {
    const titre = clean(program.metaTitle)
    const description = clean(program.metaDescription)
    if (!titre || !description) return undefined
    return { titre, description }
  }

  private mapAide(program: Program): Omit<
    CanonicalProgramInput,
    | 'id'
    | 'slug'
    | 'source'
    | 'date_mise_a_jour'
    | 'titre'
    | 'promesse'
    | 'description'
    | 'description_longue'
    | 'meta'
    | 'eligibilite'
    | 'themes'
    | 'variantes'
    | 'autres_donnees'
  > {
    return {
      statut_edition: WORKFLOW_STATUS_TO_EDITION[program.workflowStatus],
      statut_dispositif: WORKFLOW_STATUS_TO_DISPOSITIF[program.workflowStatus],
      date_ouverture: toIsoDate(program.validityStart),
      date_cloture: toIsoDate(program.validityEnd),
      remplace_par: this.mapRemplacePar(program),
      types_aides: [AID_TYPE_TO_CANONICAL[program.aidType]],
      montant: this.mapMontant(program),
      duree: this.mapDuree(program),
      operateurs: this.mapOperateurs(program),
      contact_question: this.mapContactQuestion(program),
      url_source: clean(program.url),
      etapes_activation: this.mapEtapes(program),
    }
  }

  private mapRemplacePar(program: Program): string | undefined {
    const replacedBy = program.replacedBy
    if (replacedBy && typeof replacedBy === 'object') {
      return replacedBy.canonicalId ?? undefined
    }
    return undefined
  }

  private mapMontant(program: Program): Montant | undefined {
    const config = MONTANT_BY_AID_TYPE[program.aidType]
    const valeur = clean(program[config.field] as string | null | undefined)
    return valeur ? { type: config.label, valeur } : undefined
  }

  private mapDuree(program: Program): Duree | undefined {
    const config = DUREE_BY_AID_TYPE[program.aidType]
    if (!config) return undefined
    const valeur = clean(program[config.field] as string | null | undefined)
    return valeur ? { type: config.label, valeur } : undefined
  }

  private mapOperateurs(program: Program): CanonicalProgramInput['operateurs'] {
    const autres = (program.otherOperators ?? [])
      .map((op) => operatorName(op))
      .filter((nom): nom is string => Boolean(nom))
      .map((nom) => ({ nom }))

    return {
      contact: { nom: operatorName(program.operator) ?? '' },
      ...(autres.length > 0 ? { autres } : {}),
    }
  }

  private mapContactQuestion(program: Program): ContactQuestion | undefined {
    // First selected method wins (per product decision); fall through when the
    // chosen method lacks its required value rather than emitting invalid data.
    for (const method of program.contactMethods ?? []) {
      if (method === 'advisor') return { type: 'conseiller_entreprise' }
      if (method === 'email') {
        const valeur = clean(program.contactEmail)
        if (valeur) return { type: 'email', valeur }
      }
      if (method === 'url') {
        const valeur = clean(program.contactPageUrl)
        if (valeur) return { type: 'url', valeur }
      }
    }
    return undefined
  }

  private mapEtapes(program: Program): EtapeActivation[] | undefined {
    const etapes = (program.steps ?? [])
      .map((step) => {
        const description = clean(step.description)
        if (!description) return undefined
        const liens = this.mapLiens(step.links)
        return liens.length > 0 ? { description, liens } : { description }
      })
      .filter((etape): etape is EtapeActivation => etape !== undefined)

    return etapes.length > 0 ? etapes : undefined
  }

  private mapLiens(links: NonNullable<Program['steps']>[number]['links']): Lien[] {
    return (links ?? [])
      .map((link): Lien | undefined => {
        const texte = clean(link.linkLabel)
        const url = clean(link.url)
        return texte && url ? { texte, url } : undefined
      })
      .filter((lien): lien is Lien => lien !== undefined)
  }

  private mapThemes(program: Program): CanonicalProgramInput['themes'] {
    const themes = (program.themes ?? [])
      .map((theme) => THEME_TO_CANONICAL[theme])
      .filter(Boolean)
    return themes.length > 0 ? themes : undefined
  }

  private mapEligibilite(program: Program): EligibiliteInput | undefined {
    const eligibilite: EligibiliteInput = {}

    const effectif = this.mapEffectif(program)
    if (effectif) eligibilite.effectif = effectif

    const secteurActivite = this.mapSecteurActivite(program)
    if (secteurActivite) eligibilite.secteur_activite = secteurActivite

    const secteurGeographique = this.mapSecteurGeographique(program)
    if (secteurGeographique) eligibilite.secteur_geographique = secteurGeographique

    const autresCriteres = this.mapAutresCriteres(program)
    if (autresCriteres) eligibilite.autres_criteres = autresCriteres

    return Object.keys(eligibilite).length > 0 ? eligibilite : undefined
  }

  private mapEffectif(program: Program): EligibiliteInput['effectif'] | undefined {
    const sizes = program.companySizes ?? []
    if (sizes.length === 0) return undefined

    const texte = sizes.map((size) =>
      size === 'other' ? (clean(program.companySizeOther) ?? COMPANY_SIZE_LABELS.other) : COMPANY_SIZE_LABELS[size],
    )

    const numeric = sizes.filter((size) => size !== 'other')
    // All numeric buckets selected = no real constraint, so emit no structure.
    const structure =
      numeric.length === 0 || numeric.length === NUMERIC_COMPANY_SIZE_COUNT
        ? undefined
        : this.deriveInterval(numeric)

    return { texte, ...(structure ? { structure } : {}) }
  }

  private deriveInterval(
    sizes: NumericCompanySize[],
    boundsBySize: Record<NumericCompanySize, { min?: number; max?: number }> = COMPANY_SIZE_BOUNDS,
  ): { min?: number; max?: number } | undefined {
    const bounds = sizes.map((size) => boundsBySize[size])
    const mins = bounds.map((b) => b.min).filter((m): m is number => m !== undefined)
    const min = mins.length > 0 ? Math.min(...mins) : undefined
    // An open-ended bucket (no max) makes the whole interval open-ended.
    const hasOpenEnd = bounds.some((b) => b.max === undefined)
    const maxes = bounds.map((b) => b.max).filter((m): m is number => m !== undefined)
    const max = hasOpenEnd || maxes.length === 0 ? undefined : Math.max(...maxes)

    if (min === undefined && max === undefined) return undefined
    return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) }
  }

  private mapSecteurActivite(program: Program): EligibiliteInput['secteur_activite'] | undefined {
    const sectors = program.activitySectors ?? []
    // 'all' alone means no sector restriction.
    if (sectors.length === 0 || (sectors.length === 1 && sectors[0] === 'all')) return undefined

    const texte = sectors
      .filter((sector) => sector !== 'all')
      .map((sector) => {
        if (sector === 'other') return clean(program.activitySectorOther) ?? ACTIVITY_SECTOR_LABELS.other
        if (sector === 'naf-code') return clean(program.nafCodeOther) ?? ACTIVITY_SECTOR_LABELS['naf-code']
        return ACTIVITY_SECTOR_LABELS[sector]
      })

    const nafCode = sectors.includes('naf-code') ? clean(program.nafCodeOther) : undefined
    const structure = nafCode ? { inclusions: [nafCode] } : undefined

    if (texte.length === 0 && !structure) return undefined
    return { ...(texte.length > 0 ? { texte } : {}), ...(structure ? { structure } : {}) }
  }

  private mapSecteurGeographique(program: Program): EligibiliteInput['secteur_geographique'] | undefined {
    const areas = (program.geographicAreas ?? []).filter(
      (area): area is GeographicArea => typeof area === 'object' && area !== null,
    )

    const texte = areas.map((area) => area.name)
    const feedback = clean(program.geographicAreaFeedback)
    if (feedback) texte.push(feedback)

    const inclusions = areas
      .map((area) => this.toCogCode(area))
      .filter((code): code is string => code !== undefined)
    const structure = inclusions.length > 0 ? { inclusions } : undefined

    if (texte.length === 0 && !structure) return undefined
    return { ...(texte.length > 0 ? { texte } : {}), ...(structure ? { structure } : {}) }
  }

  private toCogCode(area: GeographicArea): string | undefined {
    const prefix = COVERAGE_TYPE_TO_COG_PREFIX[area.coverageType]
    const code = clean(area.inseeCode)
    return prefix && code ? `${prefix}-${code}` : undefined
  }

  private mapAutresCriteres(program: Program): EligibiliteInput['autres_criteres'] | undefined {
    const texte = (program.otherCriteria ?? [])
      .map((criterion) => clean(criterion.value))
      .filter((value): value is string => Boolean(value))
    return texte.length > 0 ? { texte } : undefined
  }

  private mapVariantes(program: Program): VarianteInput[] | undefined {
    const variantes = (program.variants ?? [])
      .map((variant) => this.mapVariante(program, variant))
      .filter((variante): variante is VarianteInput => variante !== undefined)
    return variantes.length > 0 ? variantes : undefined
  }

  private mapVariante(program: Program, variant: VarianteRow): VarianteInput | undefined {
    const conditions = this.mapVarianteConditions(variant.conditions ?? [])
    if (!conditions) return undefined
    const modifications = this.mapVarianteModifications(program, variant.modifications ?? [])
    if (!modifications) return undefined
    return { conditions, modifications }
  }

  private mapVarianteConditions(rows: ConditionRow[]): VarianteConditionsInput | undefined {
    const effectif = this.mapVarianteEffectif(rows)
    const regions = this.mapVarianteRegions(rows)
    if (!effectif && !regions) return undefined
    return { ...(effectif ? { effectif } : {}), ...(regions ? { regions } : {}) }
  }

  private mapVarianteEffectif(rows: ConditionRow[]): { min?: number; max?: number } | undefined {
    const buckets = rows
      .filter((row) => row.conditionType === 'companySize')
      // companySizeValue is a JSON column: coerce the loose value to string codes.
      .flatMap((row) => (Array.isArray(row.companySizeValue) ? row.companySizeValue : []))
      .filter((bucket): bucket is string => typeof bucket === 'string')
      // JSON column may hold unknown/legacy codes; keep only known non-'other' buckets
      // so deriveInterval never dereferences an undefined bounds entry.
      .filter(
        (bucket): bucket is NumericCompanySize =>
          bucket !== 'other' && bucket in COMPANY_SIZE_TO_INTERVAL,
      )
    // Variant path derives its interval from the variant-domain bounds source.
    return buckets.length > 0 ? this.deriveInterval(buckets, COMPANY_SIZE_TO_INTERVAL) : undefined
  }

  private mapVarianteRegions(rows: ConditionRow[]): string[] | undefined {
    const codes = rows
      .filter((row) => row.conditionType === 'geographicArea')
      .flatMap((row) => row.geographicAreaValue ?? [])
      .filter((area): area is GeographicArea => typeof area === 'object' && area !== null)
      .map((area) => this.toCogCode(area))
      .filter((code): code is string => code !== undefined)
    const unique = [...new Set(codes)]
    return unique.length > 0 ? unique : undefined
  }

  private mapVarianteModifications(
    program: Program,
    rows: NonNullable<VarianteRow['modifications']>,
  ): VarianteModificationsInput | undefined {
    const modifications: VarianteModificationsInput = {}
    // Multi-value targets accumulate across rows (one operator / one bullet each).
    const autresOperateurs: { nom: string }[] = []
    const effectifTexte: string[] = []
    const autresCriteresTexte: string[] = []

    for (const row of rows) {
      // Operator targets read a relationship picker; the others read newValue.
      // Last write wins when several rows target the same single-value field.
      if (row.field === 'contactOperateur') {
        const nom = operatorName(row.contactOperator)
        if (nom) modifications.operateurs = { ...modifications.operateurs, contact: { nom } }
        continue
      }
      if (row.field === 'autresOperateurs') {
        for (const op of row.otherOperators ?? []) {
          const nom = operatorName(op)
          if (nom) autresOperateurs.push({ nom })
        }
        continue
      }
      const valeur = clean(row.newValue)
      if (!valeur) continue
      switch (row.field) {
        case 'montant':
          modifications.montant = { type: MONTANT_BY_AID_TYPE[program.aidType].label, valeur }
          break
        case 'duree':
          modifications.duree = { type: DUREE_BY_AID_TYPE[program.aidType]?.label ?? 'Durée', valeur }
          break
        case 'urlSource':
          modifications.url_source = valeur
          break
        case 'eligibiliteEffectif':
          effectifTexte.push(valeur)
          break
        case 'autresCriteres':
          autresCriteresTexte.push(valeur)
          break
      }
    }

    if (autresOperateurs.length > 0) {
      modifications.operateurs = { ...modifications.operateurs, autres: autresOperateurs }
    }
    const eligibilite: NonNullable<VarianteModificationsInput['eligibilite']> = {}
    if (effectifTexte.length > 0) eligibilite.effectif = { texte: effectifTexte }
    if (autresCriteresTexte.length > 0) eligibilite.autres_criteres = { texte: autresCriteresTexte }
    if (Object.keys(eligibilite).length > 0) modifications.eligibilite = eligibilite

    return Object.keys(modifications).length > 0 ? modifications : undefined
  }
}
