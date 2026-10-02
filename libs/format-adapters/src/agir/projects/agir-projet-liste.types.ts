/**
 * Index entry served by `GET /api/agir/projects`.
 *
 * ⚠️ Placeholder: AGIR has not specified the project format yet. Key names
 * mirror the programs index (`ListeDispositif`) and are to confirm with AGIR.
 */
export interface ListeProjet {
  /** The project slug. */
  idProjet: string
  titre: string
  source: string
  etatProjet: string
  dateDerniereModification: string
  urlPivot: string
}
