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
import { clean, operatorName, toIsoDate } from './mapperHelpers'
import {
  AID_TYPE_TO_CANONICAL,
  ALL_NAF_SECTIONS,
  COMPANY_SIZE_BOUNDS,
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

  /** Verbatim displayed bullets → `texte`; blanks dropped, `undefined` when empty. */
  private bullets(items: { value?: string | null }[] | null | undefined): string[] | undefined {
    const texte = (items ?? [])
      .map((item) => clean(item.value))
      .filter((value): value is string => Boolean(value))
    return texte.length > 0 ? texte : undefined
  }

  private mapEffectif(program: Program): EligibiliteInput['effectif'] | undefined {
    const structure = this.effectifStructure(program)
    return structure ? { structure } : undefined
  }

  /** Headcount interval derived from the structured size selects. */
  private effectifStructure(program: Program): { min?: number; max?: number } | undefined {
    const sizes = program.companySizes ?? []
    if (sizes.length === 0) return undefined
    const numeric = sizes.filter((size) => size !== 'other')
    // All numeric buckets selected = no real constraint. The "autre" bucket carries
    // an explicit "De X à Y" range (off-boundary effectif) parsed back here.
    if (numeric.length === NUMERIC_COMPANY_SIZE_COUNT) return undefined
    const interval =
      numeric.length === 0 ? this.parseSizeText(program.companySizeOther) : this.deriveInterval(numeric)
    return this.normalizeInterval(interval)
  }

  /**
   * A lower bound of 0 means "no minimum headcount", i.e. no real lower bound:
   * drop it so the interval (and the exported `minEmployees`) is omitted, matching
   * a source that has no `minEmployees`. When nothing meaningful remains, the whole
   * interval is dropped. Centralised here so both the bucket-derived and the
   * off-boundary « De 0 à Y » paths are normalised once.
   */
  private normalizeInterval(
    interval: { min?: number; max?: number } | undefined,
  ): { min?: number; max?: number } | undefined {
    if (!interval) return undefined
    const min = interval.min === 0 ? undefined : interval.min
    const { max } = interval
    if (min === undefined && max === undefined) return undefined
    return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) }
  }

  /** « De X à Y » / « À partir de X » (tranche « autre ») → intervalle. */
  private parseSizeText(text: string | null | undefined): { min?: number; max?: number } | undefined {
    const value = clean(text)
    if (!value) return undefined
    const range = /de\s+(\d+)\s+à\s+(\d+)/i.exec(value)
    if (range) return { min: Number(range[1]), max: Number(range[2]) }
    const from = /à partir de\s+(\d+)/i.exec(value)
    if (from) return { min: Number(from[1]) }
    return undefined
  }

  private deriveInterval(
    sizes: Exclude<NonNullable<Program['companySizes']>[number], 'other'>[],
  ): { min?: number; max?: number } | undefined {
    const bounds = sizes.map((size) => COMPANY_SIZE_BOUNDS[size])
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
    const inclusions = this.nafSectionInclusions(program)
    return inclusions.length > 0 ? { structure: { inclusions } } : undefined
  }

  /**
   * « Tous secteurs » covers every NAF section, so it expands to the full A–U
   * list (deliberately kept out of the form). An explicit, partial selection
   * reads the section letters / codes entered in `nafCodeOther`.
   */
  private nafSectionInclusions(program: Program): string[] {
    const sectors = program.activitySectors ?? []
    if (sectors.includes('all')) return [...ALL_NAF_SECTIONS]
    if (sectors.includes('naf-code')) return this.nafInclusions(program.nafCodeOther)
    return []
  }

  /** NAF section letters / codes from the multi-value field, blanks dropped. */
  private nafInclusions(values: string[] | null | undefined): string[] {
    return (values ?? [])
      .map((value) => clean(value))
      .filter((value): value is string => Boolean(value))
  }

  private mapSecteurGeographique(program: Program): EligibiliteInput['secteur_geographique'] | undefined {
    const areas = (program.geographicAreas ?? []).filter(
      (area): area is GeographicArea => typeof area === 'object' && area !== null,
    )
    const inclusions = areas
      .map((area) => this.toCogCode(area))
      .filter((code): code is string => code !== undefined)
    return inclusions.length > 0 ? { structure: { inclusions } } : undefined
  }

  private toCogCode(area: GeographicArea): string | undefined {
    const prefix = COVERAGE_TYPE_TO_COG_PREFIX[area.coverageType]
    const code = clean(area.inseeCode)
    return prefix && code ? `${prefix}-${code}` : undefined
  }

  private mapAutresCriteres(program: Program): EligibiliteInput['autres_criteres'] | undefined {
    const texte = this.bullets(program.otherCriteria)
    return texte ? { texte } : undefined
  }
}
