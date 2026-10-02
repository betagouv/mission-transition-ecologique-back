import type { CanonicalProjectInput } from '@tee-backoffice/canonical'
import type { Project } from '../../../payload-types'
import type { RichTextToMarkdown, RichTextValue } from './rich-text/RichTextToMarkdown'
import { THEME_TO_CANONICAL } from './canonicalMappings'
import { clean } from './mapperHelpers'

type DescriptionInput = CanonicalProjectInput['description_longue']

/**
 * Transforms a Payload `Project` into a raw `CanonicalProjectInput`, ready to be
 * validated by `CanonicalProjectValidator`. Like `ProgramCanonicalMapper`, it
 * only restructures and relabels data. Relations (`image`, `programs`,
 * `linkedProjects`, `replacedBy`) must be populated (`depth >= 1`): one left as an id, or
 * without a canonical id, is omitted rather than guessed. Optional blocks with
 * nothing to carry are omitted, never written empty.
 */
export class ProjectCanonicalMapper {
  constructor(private readonly richText: RichTextToMarkdown) {}

  map(project: Project): CanonicalProjectInput {
    return {
      id: project.canonicalId ?? '',
      slug: project.slug,
      source: 'INTERNE',
      date_mise_a_jour: project.updatedAt,
      ...this.mapStatut(project),
      titre: project.title,
      nom_court: project.nameTag,
      description_courte: project.shortDescription,
      image: this.mapImage(project),
      // A required block: an empty conversion is kept so validation fails loudly.
      description_longue: this.mapDescription(project.titleLongDescription, project.longDescription),
      description_complementaire: this.mapMoreDescription(project),
      theme_principal: THEME_TO_CANONICAL[project.mainTheme],
      themes: this.mapThemes(project),
      secteurs: project.sectors?.length ? [...project.sectors] : undefined,
      priorite: this.mapPriorite(project),
      dispositifs: this.mapDispositifs(project),
      projets_lies: this.mapProjetsLies(project),
      faq: this.mapFaq(project),
      seo: this.mapSeo(project),
    }
  }

  /** A replaced project carries the canonical id of its replacement; one left unpopulated fails validation loudly. */
  private mapStatut(project: Project): Pick<CanonicalProjectInput, 'statut_projet' | 'remplace_par'> {
    if (project.workflowStatus !== 'remplace') return { statut_projet: 'valide' }
    const replacedBy = project.replacedBy
    const remplacePar = replacedBy && typeof replacedBy === 'object' ? (replacedBy.canonicalId ?? undefined) : undefined
    return { statut_projet: 'remplace', ...(remplacePar ? { remplace_par: remplacePar } : {}) }
  }

  private mapImage(project: Project): CanonicalProjectInput['image'] {
    const image = project.image
    if (!image || typeof image !== 'object') return undefined
    const url = clean(image.url)
    if (!url) return undefined
    const cheminSource = clean(image.sourcePath)
    return { url, ...(cheminSource ? { chemin_source: cheminSource } : {}) }
  }

  private mapDescription(title: string | null | undefined, content: RichTextValue | null | undefined): DescriptionInput {
    const titre = clean(title)
    return { ...(titre ? { titre } : {}), contenu: this.richText.convert(content) }
  }

  private mapMoreDescription(project: Project): CanonicalProjectInput['description_complementaire'] {
    const description = this.mapDescription(project.titleMoreDescription, project.moreDescription)
    return description.contenu.trim().length > 0 ? description : undefined
  }

  private mapThemes(project: Project): CanonicalProjectInput['themes'] {
    const themes = (project.themes ?? []).map((theme) => THEME_TO_CANONICAL[theme]).filter(Boolean)
    return themes.length > 0 ? themes : undefined
  }

  private mapPriorite(project: Project): CanonicalProjectInput['priorite'] {
    const parSecteur = (project.sectorPriorities ?? []).map((row) => ({
      code_naf: row.nafCode,
      priorite: row.priority,
    }))
    const priorite: NonNullable<CanonicalProjectInput['priorite']> = {
      ...(project.defaultPriority != null ? { defaut: project.defaultPriority } : {}),
      ...(project.highlightPriority != null ? { mise_en_avant: project.highlightPriority } : {}),
      ...(parSecteur.length > 0 ? { par_secteur: parSecteur } : {}),
    }
    return Object.keys(priorite).length > 0 ? priorite : undefined
  }

  private mapDispositifs(project: Project): CanonicalProjectInput['dispositifs'] {
    const ids = ProjectCanonicalMapper.canonicalIds(project.programs)
    return ids.length > 0 ? ids : undefined
  }

  private mapProjetsLies(project: Project): CanonicalProjectInput['projets_lies'] {
    const projets = ProjectCanonicalMapper.canonicalIds(project.linkedProjects)
    const titre = clean(project.titleLinkedProjects)
    const description = clean(project.descriptionLinkedProjects)
    if (projets.length === 0 && !titre && !description) return undefined
    return { ...(titre ? { titre } : {}), ...(description ? { description } : {}), projets }
  }

  private mapFaq(project: Project): CanonicalProjectInput['faq'] {
    const questions = (project.faqs ?? [])
      .map((faq) => ({ question: clean(faq.question), reponse: this.richText.convert(faq.answer) }))
      .filter((faq): faq is { question: string; reponse: string } =>
        Boolean(faq.question) && faq.reponse.trim().length > 0,
      )
    if (questions.length === 0) return undefined
    const titre = clean(project.titleFaq)
    return { ...(titre ? { titre } : {}), questions }
  }

  private mapSeo(project: Project): CanonicalProjectInput['seo'] {
    const titre = clean(project.metaTitle)
    const description = clean(project.metaDescription)
    if (!titre && !description) return undefined
    return { ...(titre ? { titre } : {}), ...(description ? { description } : {}) }
  }

  private static canonicalIds(
    relations: (number | { canonicalId?: string | null })[] | null | undefined,
  ): string[] {
    return (relations ?? [])
      .map((relation) => (typeof relation === 'object' ? relation.canonicalId : undefined))
      .filter((id): id is string => Boolean(id))
  }
}
