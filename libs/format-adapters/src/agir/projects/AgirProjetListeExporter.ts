import type { CanonicalProject } from '@tee-backoffice/canonical'
import { AgirSourceMapper } from '../AgirSourceMapper'
import { AgirProjetEtatMapper } from './AgirProjetEtatMapper'
import type { ListeProjet } from './agir-projet-liste.types'

export interface AgirProjetListeExporterOptions {
  /** Public base URL the pivot links are built from (no trailing slash needed). */
  baseUrl: string
}

/**
 * Projects canonical projects to the AGIR index (`ListeProjet[]`). Every stored
 * project is published, so there is no inclusion filter: redirect tombstones
 * ship too, with `etatProjet: remplace`.
 */
export class AgirProjetListeExporter {
  private readonly baseUrl: string

  constructor(options: AgirProjetListeExporterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
  }

  exportMany(projects: readonly CanonicalProject[]): ListeProjet[] {
    return projects.map((project) => this.export(project))
  }

  export(project: CanonicalProject): ListeProjet {
    const d = project.data

    return {
      idProjet: d.slug,
      titre: d.titre,
      source: AgirSourceMapper.toAgir(d.source),
      etatProjet: AgirProjetEtatMapper.toEtat(d.statut_projet),
      dateDerniereModification: d.date_mise_a_jour,
      urlPivot: `${this.baseUrl}/api/agir/projects/${encodeURIComponent(d.slug)}/pivot`,
    }
  }
}
