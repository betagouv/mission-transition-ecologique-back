/** Validity window of an index entry (both bounds optional). */
export interface ListeDispositifDate {
  dateDebut?: string
  dateFin?: string
}

/**
 * Index entry served by `GET /api/agir/programs`. Mirrors
 * `ListeDispositif TEE R2DA v1.0` and adds two detail URLs per entry
 * (`urlDetail` = proposition 1, `urlPivot` = proposition 2).
 */
export interface ListeDispositif {
  idDispositif: string
  idFonctionnel: string
  titre: string
  source: string
  dateDispositif: ListeDispositifDate
  dateDerniereModification?: string
  etatDispositif: string
  /** Added vs R2DA: detail URL (proposition 1). ⚠️ key name to confirm with AGIR. */
  urlDetail: string
  /** Added vs R2DA: pivot URL (proposition 2). ⚠️ key name to confirm with AGIR. */
  urlPivot: string
}
