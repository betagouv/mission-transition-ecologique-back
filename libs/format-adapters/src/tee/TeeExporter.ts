import type {
  CanonicalProgram,
  CanonicalProgramData,
  CanonicalProgramInput,
  ContactQuestion,
  Eligibilite,
  EtapeActivation,
  Lien,
  Variante,
} from '@tee-backoffice/canonical'
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import { ConsoleExportLogger } from '../shared/ConsoleExportLogger'
import type { ExportLogger } from '../shared/ExportLogger'
import { ExportPolicy } from '../shared/ExportPolicy'
import { NafSectionResolver } from '../shared/NafSectionResolver'
import { RegionNameResolver } from '../shared/RegionNameResolver'
import { ThemeMapper } from '../shared/ThemeMapper'
import { TypeAideMapper } from '../shared/TypeAideMapper'
import { TeeImporter } from './TeeImporter'
import type {
  TeeChampConditionnel,
  TeeConditionsEligibilite,
  TeeEligibilityData,
  TeeLien,
  TeeObjectif,
  TeeProgram,
} from './tee-program.types'

/** Importer used by the exporter's round-trip self-check. */
export interface TeeRecordImporter {
  import(record: TeeProgram): CanonicalProgramInput
}

export interface TeeExporterOptions {
  /** Where round-trip diagnostics go. Default: stderr (`ConsoleExportLogger`). */
  logger?: ExportLogger
  /** Re-import every export and report fields that don't round-trip. Default: true. */
  selfCheck?: boolean
  importer?: TeeRecordImporter
  validator?: CanonicalProgramValidator
}

/**
 * Projects a pivot program to the iso `programs.json` shape (no `publicodes`,
 * no `activable en autonomie`). The projection itself is a pure transformation
 * with no external reads; `montant`/`duree` fall back to their historical key
 * via the self-describing label (`montant.type` / `duree.type`).
 *
 * By default the exporter self-checks each export: it re-imports the output and
 * re-exports it, then reports any field that does not survive the round-trip.
 * This is the package's signal that an export format is not content-perfect —
 * one import feeds many export formats, each verified the same way.
 */
export class TeeExporter {
  // Keys absent from the pivot that intentionally never round-trip, so the
  // self-check does not count them as discrepancies.
  private static readonly NON_ROUND_TRIP_KEYS = ['publicodes', 'activable en autonomie', 'illustration']

  private readonly logger: ExportLogger
  private readonly selfCheck: boolean
  private readonly importer: TeeRecordImporter
  private readonly validator: CanonicalProgramValidator

  constructor(options: TeeExporterOptions = {}) {
    this.logger = options.logger ?? new ConsoleExportLogger()
    this.selfCheck = options.selfCheck ?? true
    this.importer = options.importer ?? new TeeImporter()
    this.validator = options.validator ?? new CanonicalProgramValidator()
  }

  /**
   * CMS pivot montant/durée labels → historical programs.json keys. A label
   * already in historical form (e.g. direct import) passes through unchanged.
   */
  private static readonly LABEL_TO_TEE: Record<string, string> = {
    'Montant du financement': 'montant du financement',
    'Montant du prêt': 'montant du prêt',
    "Montant de l'avantage fiscal": "montant de l'avantage fiscal",
    'Coût restant à charge': "coût de l'accompagnement",
    'Durée du prêt': 'durée du prêt',
    'Durée de la formation': "durée de l'accompagnement",
    "Durée du diagnostic ou de l'étude": "durée de l'accompagnement",
  }

  private static teeLabel(label: string): string {
    return TeeExporter.LABEL_TO_TEE[label] ?? label
  }

  /** Published programs only (`statut_edition === 'pret_prod'`). */
  exportMany(programs: readonly CanonicalProgram[]): TeeProgram[] {
    return programs.filter((program) => ExportPolicy.isPublished(program)).map((program) => this.export(program))
  }

  export(program: CanonicalProgram): TeeProgram {
    const out = this.build(program)
    if (this.selfCheck) this.reportRoundTrip(out)
    return out
  }

  private build(program: CanonicalProgram): TeeProgram {
    const d = program.data

    const out: TeeProgram = {
      id: d.slug,
      type: 'tee',
      titre: d.titre,
      description: d.description,
      'opérateur de contact': d.operateurs.contact.nom,
      "nature de l'aide": TypeAideMapper.toNatureAideLabel(d.types_aides),
    }

    if (d.promesse !== undefined) out.promesse = d.promesse
    if (d.description_longue !== undefined) out['description longue'] = d.description_longue
    if (d.meta) {
      out.metaTitre = d.meta.titre
      out.metaDescription = d.meta.description
    }
    if (d.illustration) out.illustration = d.illustration.url
    if (d.operateurs.autres?.length) out['autres opérateurs'] = d.operateurs.autres.map((o) => o.nom)

    const contact = this.contactQuestion(d.contact_question)
    if (contact !== undefined) out['contact question'] = contact
    if (d.url_source !== undefined) out.url = d.url_source

    const debut = this.frenchDate(d.date_ouverture)
    if (debut) out['début de validité'] = debut
    const fin = this.frenchDate(d.date_cloture)
    if (fin) out['fin de validité'] = fin
    if (d.statut_dispositif === 'temporairement_indisponible') {
      out['aide temporairement indisponible'] = 'oui'
    }

    // Montant / durée: the key IS the pivot label, mapped back to the
    // historical programs.json label (CMS canonical labels differ).
    if (d.montant) out[TeeExporter.teeLabel(d.montant.type)] = d.montant.valeur
    if (d.duree) out[TeeExporter.teeLabel(d.duree.type)] = d.duree.valeur

    const objectifs = this.objectifs(d.etapes_activation)
    if (objectifs) out.objectifs = objectifs

    const conditions = this.conditions(d.eligibilite)
    if (conditions) out["conditions d'éligibilité"] = conditions

    const eligibilityData = this.eligibilityData(d)
    if (eligibilityData) out.eligibilityData = eligibilityData

    const champs = this.champsConditionnels(d.variantes)
    if (champs) out['champs conditionnels'] = champs

    return out
  }

  /** `email` → `mailto:…` · `url` → raw URL · `conseiller_entreprise` → `formulaire`. */
  private contactQuestion(cq: ContactQuestion | undefined): string | undefined {
    if (!cq) return undefined
    switch (cq.type) {
      case 'email':
        return `mailto:${cq.valeur}`
      case 'url':
        return cq.valeur
      case 'conseiller_entreprise':
        return 'formulaire'
    }
  }

  private objectifs(etapes: EtapeActivation[] | undefined): TeeObjectif[] | undefined {
    if (!etapes?.length) return undefined
    return etapes.map((etape) => {
      const objectif: TeeObjectif = { description: etape.description }
      if (etape.liens?.length) objectif.liens = etape.liens.map((lien) => this.lien(lien))
      return objectif
    })
  }

  private lien(lien: Lien): TeeLien {
    return 'conseiller_entreprise' in lien ? { formulaire: true } : { lien: lien.url, texte: lien.texte }
  }

  private conditions(elig: Eligibilite | undefined): TeeConditionsEligibilite | undefined {
    if (!elig) return undefined
    const conditions: TeeConditionsEligibilite = {}
    // « taille de l'entreprise » groups headcount + legal category (e.g. micro exclusion).
    const taille = [...(elig.effectif?.texte ?? []), ...(elig.categorie_legale?.texte ?? [])]
    if (taille.length) conditions["taille de l'entreprise"] = taille
    if (elig.secteur_geographique?.texte?.length) {
      conditions['secteur géographique'] = elig.secteur_geographique.texte
    }
    if (elig.secteur_activite?.texte?.length) conditions["secteur d'activité"] = elig.secteur_activite.texte
    if (elig.anciennete?.texte?.length) conditions["nombre d'années d'activité"] = elig.anciennete.texte
    if (elig.autres_criteres?.texte?.length) {
      conditions["autres critères d'éligibilité"] = elig.autres_criteres.texte
    }
    return Object.keys(conditions).length ? conditions : undefined
  }

  private eligibilityData(d: CanonicalProgramData): TeeEligibilityData | undefined {
    const elig = d.eligibilite
    const company: TeeEligibilityData['company'] = {}

    const naf = elig?.secteur_activite?.structure?.inclusions
    if (naf?.length) company.allowedNafSections = NafSectionResolver.sectionsOf(naf)
    const effectif = elig?.effectif?.structure
    if (effectif?.min !== undefined) company.minEmployees = String(effectif.min)
    if (effectif?.max !== undefined) company.maxEmployees = String(effectif.max)
    if (elig?.categorie_legale?.structure?.interdit?.includes('micro_entrepreneur')) {
      company.excludeMicroentrepreneur = true
    }
    const regions = elig?.secteur_geographique?.structure?.inclusions
    if (regions?.length) {
      const names = RegionNameResolver.namesOf(regions)
      if (names.length) company.allowedRegion = names
    }

    const validity: TeeEligibilityData['validity'] = {}
    const start = this.frenchDate(d.date_ouverture)
    if (start) validity.start = start
    const end = this.frenchDate(d.date_cloture)
    if (end) validity.end = end

    const priorityObjectives = d.themes ? ThemeMapper.toEnglishList(d.themes) : undefined

    if (!Object.keys(company).length && !Object.keys(validity).length && !priorityObjectives) {
      return undefined
    }
    // Omit `validity` when empty: programs.json drops it rather than emitting `{}`.
    const result: TeeEligibilityData = { company }
    if (Object.keys(validity).length) result.validity = validity
    if (priorityObjectives) result.priorityObjectives = priorityObjectives
    return result
  }

  /**
   * Rebuilds `champs conditionnels` from `variantes`. Conditions render as simple
   * expressions (no publicodes engine): headcount bounds become an AND
   * (`toutes ces conditions`), a region list becomes an OR (`une de ces
   * conditions`) using the historical region names. Inverse of `TeeImporter`.
   */
  private champsConditionnels(variantes: Variante[] | undefined): TeeChampConditionnel[] | undefined {
    if (!variantes?.length) return undefined
    return variantes.map((variante) => {
      const champ: TeeChampConditionnel = {}
      const { effectif, regions } = variante.conditions
      const toutes: string[] = []
      if (effectif?.min !== undefined) toutes.push(`effectif >= ${effectif.min}`)
      if (effectif?.max !== undefined) toutes.push(`effectif <= ${effectif.max}`)
      if (toutes.length) champ['toutes ces conditions'] = toutes
      // Resolve first: `namesOf` skips non-REG/OM COG levels, so guard on the
      // resolved names to avoid emitting an empty `une de ces conditions: []`.
      const regionNames = regions?.length ? RegionNameResolver.namesOf(regions) : []
      if (regionNames.length) {
        champ['une de ces conditions'] = regionNames.map((name) => `région = ${name}`)
      }

      const mods = variante.modifications
      if (mods.operateurs?.contact) champ['opérateur de contact'] = mods.operateurs.contact.nom
      if (mods.operateurs?.autres?.length) champ['autres opérateurs'] = mods.operateurs.autres.map((o) => o.nom)
      if (mods.url_source !== undefined) champ.url = mods.url_source
      if (mods.montant) champ['Montant du dispositif'] = mods.montant.valeur
      if (mods.duree) champ['Durée du dispositif'] = mods.duree.valeur
      const tailleTexte = mods.eligibilite?.effectif?.texte
      if (tailleTexte?.length) champ['Eligibilité taille'] = tailleTexte.join(', ')
      const autres = mods.eligibilite?.autres_criteres?.texte
      if (autres?.length) champ["autres critères d'éligibilité"] = autres
      return champ
    })
  }

  /** ISO (`2026-01-01` or date-time) → `DD/MM/YYYY`. */
  private frenchDate(iso: string | undefined): string | undefined {
    if (!iso) return undefined
    const [year, month, day] = iso.slice(0, 10).split('-')
    if (!year || !month || !day) return undefined
    return `${day}/${month}/${year}`
  }

  /**
   * Round-trip self-check: re-import the export and re-export it, then report
   * fields that don't survive. A re-import that fails validation is reported as
   * an import failure (the export can't be verified at all).
   */
  private reportRoundTrip(exported: TeeProgram): void {
    const result = this.validator.validate(this.importer.import(exported))
    if (!result.success) {
      this.logger.warn(`[tee][${String(exported.id)}] export not re-importable — round-trip cannot be verified`)
      return
    }
    const fields = this.divergentFields(exported, this.build(result.program))
    if (fields.length > 0) {
      this.logger.warn(`[tee][${String(exported.id)}] non-reversible fields: ${fields.join(', ')}`)
    }
  }

  /** Top-level keys whose content differs between the two exports (excluded keys aside). */
  private divergentFields(exported: TeeProgram, reexported: TeeProgram): string[] {
    const keys = [...new Set([...Object.keys(exported), ...Object.keys(reexported)])].filter(
      (key) => !TeeExporter.NON_ROUND_TRIP_KEYS.includes(key),
    )
    return keys.filter((key) => this.normalize(exported[key]) !== this.normalize(reexported[key]))
  }

  /** Trim-tolerant, key-order-insensitive serialization for content comparison. */
  private normalize(value: unknown): string {
    const norm = (inner: unknown): unknown => {
      if (typeof inner === 'string') return inner.trim()
      if (Array.isArray(inner)) return inner.map(norm)
      if (inner && typeof inner === 'object') {
        return Object.fromEntries(
          Object.entries(inner as Record<string, unknown>)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([key, item]) => [key, norm(item)]),
        )
      }
      return inner
    }
    return JSON.stringify(norm(value))
  }
}
