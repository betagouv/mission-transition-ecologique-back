import type { CanonicalProject } from '@tee-backoffice/canonical'
import { AgirSourceMapper } from '../AgirSourceMapper'
import { AgirThemeMapper } from '../AgirThemeMapper'
import { AgirProjetEtatMapper } from './AgirProjetEtatMapper'
import type { AgirProjetReferences } from './AgirProjetReferences'
import { agirProjetImageSchema, agirProjetPivotSchema } from './agir-projet-pivot.schema'
import type { AgirProjetPivot } from './agir-projet-pivot.types'

type ProjetData = CanonicalProject['data']

export interface AgirProjetPivotExporterOptions {
  /** Public base URL a rooted image path is made absolute with (no trailing slash needed). */
  baseUrl: string
}

/**
 * Projects a canonical project to the AGIR project pivot: the canonical wire
 * with the AGIR deltas (id = slug, single `statut`, lowercased `source`, wire
 * themes, references resolved to slugs, absolute image URL). Built field by
 * field as an explicit whitelist, then re-parsed by `agirProjetPivotSchema`
 * (`.strict()`) so no internal field can leak.
 *
 * References the AGIR API cannot follow are dropped, never emitted as dead
 * links: see {@link AgirProjetReferences}.
 */
export class AgirProjetPivotExporter {
  private readonly baseUrl: string

  constructor(
    private readonly references: AgirProjetReferences,
    options: AgirProjetPivotExporterOptions,
  ) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
  }

  export(project: CanonicalProject): AgirProjetPivot {
    const d = project.data

    const out: AgirProjetPivot = {
      id: d.slug,
      source: AgirSourceMapper.toAgir(d.source),
      date_mise_a_jour: d.date_mise_a_jour,
      statut: AgirProjetEtatMapper.toEtat(d.statut_projet),
      titre: d.titre,
      nom_court: d.nom_court,
      description_courte: d.description_courte,
      description_longue: d.description_longue,
      theme_principal: AgirThemeMapper.toAgirTheme(d.theme_principal),
    }

    if (d.remplace_par) {
      const slug = this.references.projectSlug(d.remplace_par)
      if (slug) out.remplace_par = slug
    }
    const image = this.image(d.image)
    if (image) out.image = image
    if (d.description_complementaire !== undefined) out.description_complementaire = d.description_complementaire
    if (d.themes !== undefined) out.themes = AgirThemeMapper.toAgir(d.themes)
    if (d.secteurs !== undefined) out.secteurs = d.secteurs
    if (d.priorite !== undefined) out.priorite = d.priorite
    if (d.dispositifs !== undefined) {
      out.dispositifs = d.dispositifs
        .map((id) => this.references.programSlug(id))
        .filter((slug) => slug !== undefined)
    }
    if (d.projets_lies !== undefined) out.projets_lies = this.projetsLies(d.projets_lies)
    if (d.faq !== undefined) out.faq = d.faq
    if (d.seo !== undefined) out.seo = d.seo

    return agirProjetPivotSchema.parse(out)
  }

  /** `chemin_source` is internal (import idempotence) and never exposed. */
  private image(image: ProjetData['image']): AgirProjetPivot['image'] {
    if (image === undefined) return undefined
    // A rooted path is a local media URL; `//host/path` also starts with a slash but is not one.
    const isRooted = image.url.startsWith('/') && !image.url.startsWith('//')
    const parsed = agirProjetImageSchema.safeParse({ url: isRooted ? `${this.baseUrl}${image.url}` : image.url })
    return parsed.success ? parsed.data : undefined
  }

  private projetsLies(projetsLies: NonNullable<ProjetData['projets_lies']>): AgirProjetPivot['projets_lies'] {
    const out: NonNullable<AgirProjetPivot['projets_lies']> = {
      projets: projetsLies.projets
        .map((id) => this.references.linkedProjectSlug(id))
        .filter((slug) => slug !== undefined),
    }
    if (projetsLies.titre !== undefined) out.titre = projetsLies.titre
    if (projetsLies.description !== undefined) out.description = projetsLies.description
    return out
  }
}
