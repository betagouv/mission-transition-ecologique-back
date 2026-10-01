import type { RequiredDataFromCollectionSlug } from 'payload'
import type { CanonicalProjectInput } from '@tee-backoffice/canonical'
import { NAF_SECTIONS_OPTIONS, type NafSection } from '@/constants/nafSectionsOptions'
import type { MarkdownToRichText } from '../rich-text/MarkdownToRichText'
import { CANONICAL_TO_THEME } from '../canonicalMappings'
import type { ProjectRelations } from './ProjectRelations'

/** Every Payload field of a project but the two the importer computes itself. */
export type PayloadProjectData = Omit<RequiredDataFromCollectionSlug<'projects'>, 'image' | 'linkedProjects'>

export interface CanonicalProjectToPayloadResult {
  data: PayloadProjectData
  /** Canonical data the Payload model cannot hold or resolve, reported instead of silently dropped. */
  warnings: string[]
}

export interface LinkedProjectsToPayloadResult {
  linkedProjects: number[]
  warnings: string[]
}

/** Readable name of a canonical id in a warning (its slug, when the caller knows it). */
export type CanonicalIdLabel = (canonicalId: string) => string

const NAF_SECTIONS = new Set<string>(NAF_SECTIONS_OPTIONS.map((option) => option.value))

/**
 * Canonical project → Payload `projects` data, the inverse of
 * `ProjectCanonicalMapper`. It is how upstream data (read by
 * `TeeProjectImporter`) enters the CMS, so the raw upstream format is parsed in
 * one place only. Canonical ids are resolved to relation ids through
 * `ProjectRelations`.
 *
 * Every field is written, an absent one as `null` or `[]`: Payload updates start
 * from the latest version, so a field left out would keep the value of a pending
 * draft and publish it.
 */
export class CanonicalProjectToPayloadMapper {
  constructor(
    private readonly richText: MarkdownToRichText,
    private readonly relations: ProjectRelations,
    private readonly label: CanonicalIdLabel = (canonicalId) => canonicalId,
  ) {}

  /** The image and the linked projects are left to the importer: one needs a download, the other a second pass. */
  map(input: CanonicalProjectInput): CanonicalProjectToPayloadResult {
    const warnings: string[] = []

    // The reader leaves an unknown upstream theme out rather than guessing one.
    const mainTheme = CANONICAL_TO_THEME[input.theme_principal] as PayloadProjectData['mainTheme'] | undefined
    if (!mainTheme) throw new Error(`thème principal non géré : ${String(input.theme_principal ?? 'aucun')}`)

    const data: PayloadProjectData = {
      canonicalId: input.id,
      slug: input.slug,
      title: input.titre,
      nameTag: input.nom_court,
      shortDescription: input.description_courte,
      titleLongDescription: input.description_longue.titre ?? null,
      longDescription: this.richText.convert(input.description_longue.contenu),
      titleMoreDescription: input.description_complementaire?.titre ?? null,
      moreDescription: input.description_complementaire
        ? this.richText.convert(input.description_complementaire.contenu)
        : null,
      titleFaq: input.faq?.titre ?? null,
      faqs: (input.faq?.questions ?? []).map(({ question, reponse }) => ({
        question,
        answer: this.richText.convert(reponse),
      })),
      mainTheme,
      themes: (input.themes ?? []).map((theme) => CANONICAL_TO_THEME[theme]),
      sectors: this.mapSectors(input, warnings),
      highlightPriority: input.priorite?.mise_en_avant ?? null,
      defaultPriority: input.priorite?.defaut ?? null,
      sectorPriorities: (input.priorite?.par_secteur ?? []).map(({ code_naf, priorite }) => ({
        nafCode: code_naf,
        priority: priorite,
      })),
      programs: this.mapPrograms(input, warnings),
      titleLinkedProjects: input.projets_lies?.titre ?? null,
      descriptionLinkedProjects: input.projets_lies?.description ?? null,
      metaTitle: input.seo?.titre ?? null,
      metaDescription: input.seo?.description ?? null,
      // Drafts are enabled on `Projects`: without it a created project would stay a draft.
      _status: 'published',
    }

    return { data, warnings }
  }

  /** Only resolvable once every project of the batch exists in Payload. */
  mapLinkedProjects(input: CanonicalProjectInput): LinkedProjectsToPayloadResult {
    const warnings: string[] = []
    const linkedProjects: number[] = []
    for (const canonicalId of input.projets_lies?.projets ?? []) {
      const id = this.relations.projectIdByCanonicalId(canonicalId)
      if (id === undefined) warnings.push(`projet lié introuvable dans le CMS : ${this.label(canonicalId)}`)
      else linkedProjects.push(id)
    }
    return { linkedProjects, warnings }
  }

  private mapPrograms(input: CanonicalProjectInput, warnings: string[]): number[] {
    const programs: number[] = []
    for (const canonicalId of input.dispositifs ?? []) {
      const id = this.relations.programIdByCanonicalId(canonicalId)
      if (id === undefined) warnings.push(`dispositif introuvable dans le CMS : ${this.label(canonicalId)}`)
      else programs.push(id)
    }
    return programs
  }

  /** The pivot takes any NAF code, the Payload field only sections. */
  private mapSectors(input: CanonicalProjectInput, warnings: string[]): NafSection[] {
    const secteurs = input.secteurs ?? []
    const unsupported = secteurs.filter((code) => !NAF_SECTIONS.has(code))
    if (unsupported.length > 0) {
      warnings.push(`secteur(s) hors sections NAF sans équivalent Payload : ${unsupported.join(', ')}`)
    }
    return secteurs.filter((code): code is NafSection => NAF_SECTIONS.has(code))
  }
}
