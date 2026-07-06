/** A Grist column to provision: its colId, UI label and Grist type. */
export interface GristColumnSpec {
  colId: string
  label: string
  type: string
}

/**
 * Grist colId carrying the Etalab `id`. Grist reserves `id` for its built-in
 * integer row id, so a user column named `id` collides; the Etalab id lives
 * under `rnasp_id` and the data.gouv widget re-publishes it as the CSV `id`.
 * See `grist.types.ts` / `GristRowBuilder`.
 */
export const ETALAB_ID_COLID = 'rnasp_id'

/**
 * Authoritative ordered column list for the Grist dispositifs table: the Etalab
 * `dispositif-aide-professionnels` columns (superset), with `id` carried under
 * {@link ETALAB_ID_COLID}, plus the `slug` upsert key and the `technical` JSON
 * column. Everything is `Text`: the rows are CSV-ready strings pushed verbatim,
 * so Text round-trips losslessly to the data.gouv widget.
 *
 * Single source of truth shared by table provisioning (`GristTableManager`) and
 * row writing (`GristRowBuilder` / `GristClient`); the widget should import it
 * too rather than duplicate the column order.
 */
export const GRIST_COLUMNS: readonly GristColumnSpec[] = [
  { colId: ETALAB_ID_COLID, label: 'id', type: 'Text' },
  { colId: 'slug', label: 'slug', type: 'Text' },
  { colId: 'titre', label: 'titre', type: 'Text' },
  { colId: 'promesse', label: 'promesse', type: 'Text' },
  { colId: 'description', label: 'description', type: 'Text' },
  { colId: 'eligibilite', label: 'eligibilite', type: 'Text' },
  { colId: 'types_aides', label: 'types_aides', type: 'Text' },
  { colId: 'porteurs', label: 'porteurs', type: 'Text' },
  { colId: 'programmes_parents', label: 'programmes_parents', type: 'Text' },
  { colId: 'url_source', label: 'url_source', type: 'Text' },
  { colId: 'cibles', label: 'cibles', type: 'Text' },
  { colId: 'eligibilite_geographique', label: 'eligibilite_geographique', type: 'Text' },
  { colId: 'eligibilite_geographique_exclusions', label: 'eligibilite_geographique_exclusions', type: 'Text' },
  { colId: 'date_ouverture', label: 'date_ouverture', type: 'Text' },
  { colId: 'date_cloture', label: 'date_cloture', type: 'Text' },
  { colId: 'date_mise_a_jour', label: 'date_mise_a_jour', type: 'Text' },
  { colId: 'base_juridique', label: 'base_juridique', type: 'Text' },
  { colId: 'eligibilite_effectif_minimal', label: 'eligibilite_effectif_minimal', type: 'Text' },
  { colId: 'eligibilite_effectif_maximal', label: 'eligibilite_effectif_maximal', type: 'Text' },
  { colId: 'eligibilite_categorie_taille_entreprise', label: 'eligibilite_categorie_taille_entreprise', type: 'Text' },
  { colId: 'eligibilite_annees_existence_minimal', label: 'eligibilite_annees_existence_minimal', type: 'Text' },
  { colId: 'eligibilite_forme_juridique', label: 'eligibilite_forme_juridique', type: 'Text' },
  { colId: 'eligibilite_forme_juridique_exclusions', label: 'eligibilite_forme_juridique_exclusions', type: 'Text' },
  { colId: 'ciblage_secteur_activite', label: 'ciblage_secteur_activite', type: 'Text' },
  { colId: 'ciblage_naf', label: 'ciblage_naf', type: 'Text' },
  { colId: 'ciblage_naf_exclusions', label: 'ciblage_naf_exclusions', type: 'Text' },
  { colId: 'chainage_paiement', label: 'chainage_paiement', type: 'Text' },
  { colId: 'technical', label: 'technical', type: 'Text' },
]
