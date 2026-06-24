import type { CanonicalProgramInput } from '@tee-backoffice/canonical'
import { RegionNameResolver } from '../shared/RegionNameResolver'
import { ThemeMapper } from '../shared/ThemeMapper'
import { TypeAideMapper } from '../shared/TypeAideMapper'

type EligibiliteInput = NonNullable<CanonicalProgramInput['eligibilite']>
type ContactQuestionInput = NonNullable<CanonicalProgramInput['contact_question']>
type EtapeInput = NonNullable<CanonicalProgramInput['etapes_activation']>[number]
type LienInput = NonNullable<EtapeInput['liens']>[number]

/** Raw programs.json record (loose: dynamic montant/durée keys, free extras). */
export type TeeRecord = Record<string, unknown>

/** programs.json eligibilityData.company shape (best-effort, all fields optional). */
interface SourceCompany {
  allowedNafSections?: string[]
  minEmployees?: string
  maxEmployees?: string
  allowedRegion?: string[]
  excludeMicroentrepreneur?: boolean
}

/**
 * Reconstruit un `CanonicalProgramInput` brut depuis une fiche **iso
 * `programs.json`** (sans `publicodes` ni `activable en autonomie`). Inverse de
 * {@link TeeExporter}. Transformation pure ; aucune validation (c'est le rôle de
 * `CanonicalProgramValidator`).
 *
 * Les champs propres au pivot mais absents de programs.json (`id` cuid2,
 * `source`, `date_mise_a_jour`) sont remplis par des valeurs de remplacement :
 * ils ne ressortent pas à l'export, donc n'affectent pas l'aller-retour.
 */
export class TeeImporter {
  // A real cuid2 (round-trip-safe placeholder): `id` is never re-emitted by the
  // exporter, so a constant valid value is enough to pass validation.
  private static readonly PLACEHOLDER_ID = 'tz4a98xxat96iws9zmbrgj3a'
  private static readonly PLACEHOLDER_DATE = '2026-01-01T00:00:00+00:00'

  /** Fixed programs.json keys; everything else is a dynamic montant/durée key. */
  private static readonly KNOWN_KEYS: ReadonlySet<string> = new Set([
    'id',
    'type',
    'titre',
    'promesse',
    'description',
    'description longue',
    'metaTitre',
    'metaDescription',
    'illustration',
    'opérateur de contact',
    'autres opérateurs',
    'contact question',
    "nature de l'aide",
    'url',
    'début de validité',
    'fin de validité',
    'aide temporairement indisponible',
    'objectifs',
    "conditions d'éligibilité",
    'eligibilityData',
    'champs conditionnels',
    'publicodes',
    'activable en autonomie',
  ])

  import(record: TeeRecord): CanonicalProgramInput {
    const natureLabel = this.str(record["nature de l'aide"]) ?? ''
    const typeAide = TypeAideMapper.fromNatureAideLabel(natureLabel)

    const input: CanonicalProgramInput = {
      id: TeeImporter.PLACEHOLDER_ID,
      slug: this.str(record['id']) ?? '',
      source: 'INTERNE',
      date_mise_a_jour: TeeImporter.PLACEHOLDER_DATE,
      titre: this.str(record['titre']) ?? '',
      description: this.str(record['description']) ?? '',
      statut_edition: 'pret_prod',
      statut_dispositif:
        this.str(record['aide temporairement indisponible']) === 'oui'
          ? 'temporairement_indisponible'
          : 'valide',
      types_aides: typeAide ? [typeAide] : [],
      operateurs: this.operateurs(record),
    }

    const promesse = this.str(record['promesse'])
    if (promesse) input.promesse = promesse
    const descriptionLongue = this.str(record['description longue'])
    if (descriptionLongue) input.description_longue = descriptionLongue

    const meta = this.meta(record)
    if (meta) input.meta = meta

    // `illustration` is intentionally not imported: programs.json carries 3 generic
    // stock paths (images/*.webp), irrelevant data the round-trip excludes.

    const contact = this.contactQuestion(record)
    if (contact) input.contact_question = contact

    const url = this.str(record['url'])
    if (url) input.url_source = url

    const dateOuverture = this.isoDate(record['début de validité'])
    if (dateOuverture) input.date_ouverture = dateOuverture
    const dateCloture = this.isoDate(record['fin de validité'])
    if (dateCloture) input.date_cloture = dateCloture

    const { montant, duree } = this.montantDuree(record)
    if (montant) input.montant = montant
    if (duree) input.duree = duree

    const etapes = this.etapes(record)
    if (etapes) input.etapes_activation = etapes

    const eligibilite = this.eligibilite(record)
    if (eligibilite) input.eligibilite = eligibilite

    const themes = this.themes(record)
    if (themes) input.themes = themes

    return input
  }

  private operateurs(record: TeeRecord): CanonicalProgramInput['operateurs'] {
    const autres = this.strArray(record['autres opérateurs']).map((nom) => ({ nom }))
    return {
      contact: { nom: this.str(record['opérateur de contact']) ?? '' },
      ...(autres.length > 0 ? { autres } : {}),
    }
  }

  private meta(record: TeeRecord): CanonicalProgramInput['meta'] {
    const titre = this.str(record['metaTitre'])
    const description = this.str(record['metaDescription'])
    if (!titre || !description) return undefined
    return { titre, description }
  }

  /** `mailto:…` → email · `formulaire` → ADEME · URL brute → url. */
  private contactQuestion(record: TeeRecord): ContactQuestionInput | undefined {
    const value = this.str(record['contact question'])
    if (!value) return undefined
    if (value.startsWith('mailto:')) return { type: 'email', valeur: value.slice('mailto:'.length) }
    if (value === 'formulaire') return { type: 'ADEME' }
    return { type: 'url', valeur: value }
  }

  /** Une seule paire montant/durée : clés dynamiques portant le libellé (« durée … » → durée). */
  private montantDuree(record: TeeRecord): {
    montant?: CanonicalProgramInput['montant']
    duree?: CanonicalProgramInput['duree']
  } {
    let montant: CanonicalProgramInput['montant']
    let duree: CanonicalProgramInput['duree']
    for (const [key, raw] of Object.entries(record)) {
      if (TeeImporter.KNOWN_KEYS.has(key)) continue
      const valeur = this.str(raw)
      if (!valeur) continue
      if (/dur[ée]e/i.test(key)) {
        duree ??= { type: key, valeur }
      } else {
        montant ??= { type: key, valeur }
      }
    }
    return { montant, duree }
  }

  private etapes(record: TeeRecord): EtapeInput[] | undefined {
    const objectifs = Array.isArray(record['objectifs']) ? (record['objectifs'] as TeeRecord[]) : []
    const etapes = objectifs
      .map((objectif): EtapeInput | undefined => {
        const description = this.str(objectif['description'])
        if (!description) return undefined
        const liens = this.liens(objectif['liens'])
        return liens.length > 0 ? { description, liens } : { description }
      })
      .filter((etape): etape is EtapeInput => etape !== undefined)
    return etapes.length > 0 ? etapes : undefined
  }

  private liens(raw: unknown): LienInput[] {
    const liens = Array.isArray(raw) ? (raw as TeeRecord[]) : []
    return liens
      .map((lien): LienInput | undefined => {
        if (lien['formulaire'] === true) return { conseiller_entreprise: true }
        const url = this.str(lien['lien'])
        const texte = this.str(lien['texte'])
        return url && texte ? { texte, url } : undefined
      })
      .filter((lien): lien is LienInput => lien !== undefined)
  }

  private eligibilite(record: TeeRecord): EligibiliteInput | undefined {
    const conditions = this.asRecord(record["conditions d'éligibilité"])
    const company = (this.asRecord(this.asRecord(record['eligibilityData'])?.['company']) ?? {}) as SourceCompany
    const eligibilite: EligibiliteInput = {}

    const taille = this.strArray(conditions?.["taille de l'entreprise"])
    const effectifStructure = this.effectifStructure(company)
    if (taille.length > 0 || effectifStructure) {
      eligibilite.effectif = {
        ...(taille.length > 0 ? { texte: taille } : {}),
        ...(effectifStructure ? { structure: effectifStructure } : {}),
      }
    }

    if (company.excludeMicroentrepreneur) {
      eligibilite.categorie_legale = { structure: { interdit: ['micro_entrepreneur'] } }
    }

    const secteurActiviteTexte = this.strArray(conditions?.["secteur d'activité"])
    const nafSections = company.allowedNafSections ?? []
    if (secteurActiviteTexte.length > 0 || nafSections.length > 0) {
      eligibilite.secteur_activite = {
        ...(secteurActiviteTexte.length > 0 ? { texte: secteurActiviteTexte } : {}),
        ...(nafSections.length > 0 ? { structure: { inclusions: nafSections } } : {}),
      }
    }

    const secteurGeoTexte = this.strArray(conditions?.['secteur géographique'])
    const regions = RegionNameResolver.codesOf(company.allowedRegion ?? [])
    if (secteurGeoTexte.length > 0 || regions.length > 0) {
      eligibilite.secteur_geographique = {
        ...(secteurGeoTexte.length > 0 ? { texte: secteurGeoTexte } : {}),
        ...(regions.length > 0 ? { structure: { inclusions: regions } } : {}),
      }
    }

    const anciennete = this.strArray(conditions?.["nombre d'années d'activité"])
    if (anciennete.length > 0) eligibilite.anciennete = { texte: anciennete }

    const autres = this.strArray(conditions?.["autres critères d'éligibilité"])
    if (autres.length > 0) eligibilite.autres_criteres = { texte: autres }

    return Object.keys(eligibilite).length > 0 ? eligibilite : undefined
  }

  private effectifStructure(company: SourceCompany): { min?: number; max?: number } | undefined {
    const min = company.minEmployees !== undefined ? Number(company.minEmployees) : undefined
    const max = company.maxEmployees !== undefined ? Number(company.maxEmployees) : undefined
    if (min === undefined && max === undefined) return undefined
    return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) }
  }

  private themes(record: TeeRecord): CanonicalProgramInput['themes'] {
    const priority = this.strArray(this.asRecord(record['eligibilityData'])?.['priorityObjectives'])
    const themes = ThemeMapper.toFrenchList(priority)
    return themes.length > 0 ? themes : undefined
  }

  /** `JJ/MM/AAAA` → `AAAA-MM-JJ`. */
  private isoDate(value: unknown): string | undefined {
    const text = this.str(value)
    if (!text) return undefined
    const [day, month, year] = text.split('/')
    if (!day || !month || !year) return undefined
    return `${year}-${month}-${day}`
  }

  private str(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined
  }

  private strArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  }

  private asRecord(value: unknown): TeeRecord | undefined {
    return typeof value === 'object' && value !== null ? (value as TeeRecord) : undefined
  }
}
