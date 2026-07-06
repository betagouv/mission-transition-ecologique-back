import type { CanonicalProgram } from '@tee-backoffice/canonical'
import { AgirEtatMapper } from './AgirEtatMapper'
import { AgirExportPolicy } from './AgirExportPolicy'
import { AgirSourceMapper } from './AgirSourceMapper'
import type { ListeDispositif, ListeDispositifDate } from './agir-liste.types'

export interface AgirListeExporterOptions {
  /** Public base URL the detail/pivot links are built from (no trailing slash needed). */
  baseUrl: string
}

/**
 * Projects published canonical programs to the AGIR index (`ListeDispositif[]`).
 * Each entry carries two detail URLs (proposition 1 + 2) built from the injected
 * base URL — never hard-coded. `exportMany` applies the AGIR inclusion filter.
 */
export class AgirListeExporter {
  private readonly baseUrl: string

  constructor(options: AgirListeExporterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
  }

  /** Exportable programs only (published + exportable status). */
  exportMany(programs: readonly CanonicalProgram[]): ListeDispositif[] {
    return programs.filter((program) => AgirExportPolicy.isExportable(program)).map((program) => this.export(program))
  }

  export(program: CanonicalProgram): ListeDispositif {
    const d = program.data

    const dateDispositif: ListeDispositifDate = {}
    if (d.date_ouverture) dateDispositif.dateDebut = d.date_ouverture
    if (d.date_cloture) dateDispositif.dateFin = d.date_cloture

    const out: ListeDispositif = {
      idDispositif: d.slug,
      idFonctionnel: d.slug,
      titre: d.titre,
      source: AgirSourceMapper.toAgir(d.source),
      dateDispositif,
      etatDispositif: AgirEtatMapper.toEtat(d.statut_dispositif),
      urlDetail: `${this.baseUrl}/api/agir/programs/${d.slug}/detail`,
      urlPivot: `${this.baseUrl}/api/agir/programs/${d.slug}/pivot`,
    }
    if (d.date_mise_a_jour) out.dateDerniereModification = d.date_mise_a_jour

    return out
  }
}
