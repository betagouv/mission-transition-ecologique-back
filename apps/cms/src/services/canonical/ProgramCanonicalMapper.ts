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
    // `workflowStatus` is required with a default in Payload; the generated type
    // is nullable only because select fields always are. Fall back to the field
    // default so the lookups stay total.
    const workflowStatus = program.workflowStatus ?? 'en-creation'
    return {
      statut_edition: WORKFLOW_STATUS_TO_EDITION[workflowStatus],
      statut_dispositif: WORKFLOW_STATUS_TO_DISPOSITIF[workflowStatus],
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
        const description = clean(this.markdown.convert(step.description))
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
}
