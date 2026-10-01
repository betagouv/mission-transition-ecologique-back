import type { CanonicalProjectInput, Theme } from '@tee-backoffice/canonical'
import { ThemeMapper } from '../shared/ThemeMapper'
import { SlugCanonicalId } from './SlugCanonicalId'
import type { TeeProject } from './tee-project.schema'
import { UpstreamAssetSource } from './UpstreamAssetSource'

type ImageInput = NonNullable<CanonicalProjectInput['image']>
type DescriptionInput = CanonicalProjectInput['description_longue']
type PrioriteInput = NonNullable<CanonicalProjectInput['priorite']>
type ProjetsLiesInput = NonNullable<CanonicalProjectInput['projets_lies']>
type FaqInput = NonNullable<CanonicalProjectInput['faq']>
type SeoInput = NonNullable<CanonicalProjectInput['seo']>

export interface TeeProjectImporterOptions {
  /** Base URL of the upstream front's public folder. Defaults to the one of `UpstreamAssetSource`. */
  assetsBaseUrl?: string
}

/**
 * The single reader of the upstream `projects.json` format: the daily canonical
 * import and the CMS seed both go through it, so a format change is handled in
 * one place.
 *
 * Pure transformation, no validation (that is the role of
 * `CanonicalProjectValidator`). An optional block with nothing in it is left
 * out, since the canonical schema would accept it empty. What cannot be carried
 * over is reported through {@link warnings}, never dropped silently.
 */
export class TeeProjectImporter {
  private readonly assets: UpstreamAssetSource
  private collected: string[] = []
  private unusableImages = new Map<string, string>()

  constructor(options: TeeProjectImporterOptions = {}) {
    this.assets = new UpstreamAssetSource({ baseUrl: options.assetsBaseUrl })
  }

  /** Warnings of the last {@link importMany} run. */
  get warnings(): readonly string[] {
    return this.collected
  }

  /**
   * Upstream image paths of the last {@link importMany} run that cannot be
   * turned into a URL, by project slug. Such a project comes out without
   * `image` although upstream has one: a consumer syncing media must read it as
   * a failed download (current image kept), not as an image upstream dropped.
   */
  get unusableImagePaths(): ReadonlyMap<string, string> {
    return this.unusableImages
  }

  /** `now` stamps `date_mise_a_jour`: projects.json carries no modification date. */
  importMany(records: TeeProject[], now: string): CanonicalProjectInput[] {
    this.collected = []
    this.unusableImages = new Map()
    // Upstream links projects by numeric id, the canonical by an id derived from the slug.
    const slugByUpstreamId = new Map(records.map((record) => [record.id, record.slug]))
    return records.map((record) => this.import(record, slugByUpstreamId, now))
  }

  private import(project: TeeProject, slugByUpstreamId: Map<number, string>, now: string): CanonicalProjectInput {
    const themePrincipal = ThemeMapper.toFrench(project.mainTheme)
    if (!themePrincipal) this.warn(project, `thème principal inconnu « ${project.mainTheme} »`)

    const input: CanonicalProjectInput = {
      id: SlugCanonicalId.forProject(project.slug),
      slug: project.slug,
      source: 'INTERNE',
      date_mise_a_jour: now,
      statut_projet: 'valide',
      titre: project.title,
      nom_court: project.nameTag,
      description_courte: project.shortDescription,
      description_longue: this.description(project.titleLongDescription, project.longDescription),
      // An unknown theme is left out, never guessed: the validator then rejects the project.
      theme_principal: themePrincipal as Theme,
    }

    const image = this.image(project)
    if (image) input.image = image

    const moreDescription = this.text(project.moreDescription)
    if (moreDescription) {
      input.description_complementaire = this.description(project.titleMoreDescription, moreDescription)
    }

    const themes = this.themes(project)
    if (themes.length > 0) input.themes = themes
    if (project.sectors && project.sectors.length > 0) input.secteurs = [...project.sectors]

    const priorite = this.priorite(project)
    if (priorite) input.priorite = priorite

    if (project.programs && project.programs.length > 0) {
      input.dispositifs = project.programs.map((slug) => SlugCanonicalId.from(slug))
    }

    const projetsLies = this.projetsLies(project, slugByUpstreamId)
    if (projetsLies) input.projets_lies = projetsLies

    const faq = this.faq(project)
    if (faq) input.faq = faq

    const seo = this.seo(project)
    if (seo) input.seo = seo

    return input
  }

  private description(title: string | undefined, content: string): DescriptionInput {
    const titre = this.text(title)
    return titre ? { titre, contenu: content } : { contenu: content }
  }

  private image(project: TeeProject): ImageInput | undefined {
    const path = this.text(project.image)
    if (!path) return undefined
    try {
      return { url: this.assets.url(path), chemin_source: path }
    } catch {
      // No URL can be built, and the pivot takes no image without one.
      this.unusableImages.set(project.slug, path)
      this.warn(project, `chemin d'image invalide « ${path} »`)
      return undefined
    }
  }

  private themes(project: TeeProject): Theme[] {
    const unknown = project.themes.filter((theme) => ThemeMapper.toFrench(theme) === undefined)
    if (unknown.length > 0) this.warn(project, `thème(s) inconnu(s) ignoré(s) : ${unknown.join(', ')}`)
    return ThemeMapper.toFrenchList(project.themes)
  }

  private priorite(project: TeeProject): PrioriteInput | undefined {
    const { default: defaut, ...bySector } = project.priority ?? {}
    const priorite: PrioriteInput = {}

    if (defaut !== undefined) priorite.defaut = defaut
    const miseEnAvant = this.highlightPriority(project)
    if (miseEnAvant !== undefined) priorite.mise_en_avant = miseEnAvant
    // Sorted: the output must not depend on the key order of the upstream object.
    const parSecteur = Object.keys(bySector)
      .sort()
      .map((code) => ({ code_naf: code, priorite: bySector[code] }))
    if (parSecteur.length > 0) priorite.par_secteur = parSecteur

    return Object.keys(priorite).length > 0 ? priorite : undefined
  }

  private highlightPriority(project: TeeProject): number | undefined {
    const raw = this.text(project.highlightPriority ?? undefined)?.trim()
    if (raw === undefined) return undefined
    if (!/^\d+$/.test(raw)) {
      this.warn(project, `priorité de mise en avant non numérique « ${raw} », ignorée`)
      return undefined
    }
    return Number(raw)
  }

  private projetsLies(project: TeeProject, slugByUpstreamId: Map<number, string>): ProjetsLiesInput | undefined {
    const projets: string[] = []
    for (const upstreamId of project.linkedProjects ?? []) {
      const slug = slugByUpstreamId.get(upstreamId)
      if (slug === undefined) {
        this.warn(project, `projet lié inconnu (id amont ${upstreamId.toString()}), ignoré`)
        continue
      }
      projets.push(SlugCanonicalId.forProject(slug))
    }

    const titre = this.text(project.titleLinkedProjects)
    const description = this.text(project.descriptionLinkedProjects)
    if (projets.length === 0 && !titre && !description) return undefined

    const projetsLies: ProjetsLiesInput = { projets }
    if (titre) projetsLies.titre = titre
    if (description) projetsLies.description = description
    return projetsLies
  }

  private faq(project: TeeProject): FaqInput | undefined {
    const faqs = project.faqs ?? []
    const questions = faqs
      .filter((faq) => this.text(faq.question) !== undefined && this.text(faq.answer) !== undefined)
      .map((faq) => ({ question: faq.question, reponse: faq.answer }))
    const incomplete = faqs.length - questions.length
    if (incomplete > 0) this.warn(project, `${incomplete.toString()} question(s) de FAQ sans texte ou sans réponse, ignorée(s)`)
    if (questions.length === 0) return undefined

    const titre = this.text(project.titleFaq)
    return titre ? { titre, questions } : { questions }
  }

  private seo(project: TeeProject): SeoInput | undefined {
    const seo: SeoInput = {}
    const titre = this.text(project.metaTitle)
    if (titre) seo.titre = titre
    const description = this.text(project.metaDescription)
    if (description) seo.description = description
    return Object.keys(seo).length > 0 ? seo : undefined
  }

  /** A blank upstream cell means "absent". */
  private text(value: string | undefined): string | undefined {
    return value !== undefined && value.trim() !== '' ? value : undefined
  }

  private warn(project: TeeProject, message: string): void {
    this.collected.push(`${project.slug} : ${message}`)
  }
}
