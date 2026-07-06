# Export schéma Etalab → Grist (chantier 2)

> Contexte de la projection du canonical vers le **schéma interministériel
> Etalab** des dispositifs d'aide, en vue d'une publication open data via Grist.
> La projection vit dans `libs/format-adapters/src/schema/` et `src/grist/` ; le
> CLI dans `libs/format-adapters/scripts/export-grist.ts`. Source de lecture =
> **store canonical** (`CanonicalProgramRepository`), jamais Payload.

## Schémas cibles

Table Schema frictionless, copiés (autonomes) dans `src/schema/etalab/` et
**embarqués en modules TS** (`export default`) plutôt qu'en `.json` : un import
JSON exige un import attribute (`with { type: 'json' }`) que Node ESM impose et
que certains transpileurs (Next/Playwright) retirent, cassant le build. Éditer
ces `.ts` si le schéma amont évolue.

| Fichier | Nom | Champs |
|---|---|---|
| `dispositif-aide.schema.ts` | `dispositif-aide` (core) | 15 champs |
| `dispositif-aide-professionnels.schema.ts` | `dispositif-aide-professionnels` (entreprise) | core + éligibilité entreprise |

Tous nos dispositifs sont `professionnels` : **entreprise** est le format riche,
**core** son sous-ensemble. La gestion des listes de valeurs (types d'aides,
rôles, secteurs…) est centralisée côté data.gouv dans le
[Grist « Gestion des schémas »](https://grist.numerique.gouv.fr/o/docs/uC2J5niqzb48/Gestion-des-schemas-des-dispositifs-daide).

## Pipeline

```
canonical (store) ──SchemaExportPolicy──▶ dispositifs publiés + exportables
   └─ SchemaProgramMapper  → SchemaRow (toutes colonnes entreprise)
   └─ SchemaFitChecker + EtalabSchemaValidator → schémas satisfaits ET valides
   └─ GristRowBuilder      → GristRecord (colonnes + slug + technical JSON)
   └─ GristClient.upsertMany (PUT REST, clé = slug)   [seulement avec --push]
```

`GristExporter.exportMany(programs)` orchestre filtrage → mapping → record. Un
schéma n'est listé dans `fitted_schemas` que s'il est **à la fois** structurellement
complet (`SchemaFitChecker`) **et** valide Etalab (`EtalabSchemaValidator`) ; sinon
le manque est journalisé (champs manquants / erreurs de motif), jamais en silence.

## Filtre (`SchemaExportPolicy`)

Publié (`statut_edition === 'pret_prod'`, `ExportPolicy.isPublished`) **et**
statut exportable (`valide` / `temporairement_indisponible`,
`AgirEtatMapper.isExportable`). Les `archive`/`remplace`/`abandonne`/`inconnu`
ne sont **pas** publiés en open data. Aucune donnée AGIR ne fuite dans l'export
data.gouv : `source` est le tag statique `tee` (`SchemaVocabulary.SOURCE`, cet
export est produit par la TEE) et `statut` passe par le mapper partagé
`StatutMapper` (`shared/`, réutilisé aussi par le pivot ADEME).

## Mapping canonical → colonnes (points clés)

- `id` : **UUID v5** déterministe dérivé du `slug` (`SchemaIdResolver`, sans
  dépendance — `node:crypto`), le schéma exige `format: uuid` et le cuid2 n'en
  est pas un. ⚠️ Dans Grist cet id est porté par la colonne **`rnasp_id`**, pas
  `id` : Grist réserve `id` pour son row-id entier interne (une colonne utilisateur
  `id` entrerait en collision et `fetchTable` renverrait le row-id au lieu de
  l'UUID). Le widget (chantier 3) relit `rnasp_id` et le republie sous l'en-tête
  CSV Etalab `id`.
- `description` / `eligibilite` : le core n'a pas de structure montant/durée/
  étapes/effectif ; ces infos sont **repliées dans le texte**
  (`DescriptionTextBuilder`, `EligibiliteTextBuilder`), comme l'export legacy.
  `description_longue` reste **omise** (dépasse 5000 caractères).
- `porteurs` : JSON `[{ nom, siren?, roles[] }]`. Rôles par position (contact =
  `instructeur+diffuseur`, autres = `diffuseur`). Cas « CCI ou CMA » éclaté en
  `CCI FRANCE`/`CMA FRANCE`. SIREN/nom normalisé manquants → avertissement
  (`ExportLogger`), jamais bloquant (remontés à l'audit).
- `eligibilite_geographique` : COG canonical, **défaut `PAYS-99100`** (national).
- `ciblage_naf` : codes NAF bruts ; `ciblage_secteur_activite` (requis
  entreprise) : libellés dérivés des sections NAF, **défaut « tous secteurs
  d'activité »**. ⚠️ granularité des libellés à confirmer.
- `eligibilite_effectif_minimal/maximal` ← `effectif.structure.min/max`.
- `eligibilite_forme_juridique_exclusions` ← `categorie_legale.structure.interdit`
  (`micro_entrepreneur` → `Microentrepreneur`).

`types_aides` est mappé vers le vocabulaire schéma via `TypesAidesSchemaMapper`
(table dans `SchemaVocabulary`, ⚠️ à confirmer contre la liste Grist).

## Colonne technique JSON

À côté des colonnes Etalab, la colonne `technical` porte :

```json
{ "source": "tee", "date_mise_a_jour": "…", "statut": "actif",
  "fitted_schemas": ["dispositif-aide", "dispositif-aide-professionnels"],
  "raw_original_data": { "… copie intégrale du canonical …" } }
```

`fitted_schemas` est réutilisé par le widget (chantier 3) pour décider où
publier sans recalcul ; `raw_original_data` permet de reconstruire n'importe quel
format futur.

## Validation (double, export + widget)

`EtalabSchemaValidator` valide une `SchemaRow` contre le Table Schema embarqué
(requis, motifs COG/NAF/cibles, `maxLength`, formats uuid/uri/integer/datetime).
Il est **branché dans `GristExporter`** : un schéma n'est `fitted` (donc poussé)
que s'il passe la validation — notre export reste propre. La même validation est
**rejouée côté widget** (chantier 3) avant publication data.gouv, car la table
Grist peut aussi être éditée à la main après l'export : le widget ne fait jamais
confiance aveuglément à `fitted_schemas`.

> ⚠️ Limite connue : le motif Etalab `eligibilite_geographique`
> (`^[A-Z]+-\d+…`) rejette les codes corses (`DEP-2A/2B`). À remonter au schéma
> si de tels dispositifs apparaissent.

## Bootstrap de la table (`setup:grist`)

Ni l'upsert des lignes (`PUT …/records`) ni le widget data.gouv (chantier 3, qui
ne fait que **lire** via `fetchTable`) ne créent la table ou ses colonnes : ils
supposent la table déjà en place. `GristTableManager` (REST) l'amorce :

`pnpm nx run @tee-backoffice/format-adapters:setup:grist` — teste la connexion,
**crée** la table `GRIST_TABLE_ID` si absente, **aligne** ses colonnes sur
`GRIST_COLUMNS` (source de vérité unique : colonnes Etalab entreprise avec l'`id`
sous `rnasp_id`, + `slug` + `technical`, toutes en `Text`). Idempotent.
`-- --prune` supprime en plus les colonnes hors schéma (les `A`/`B`/`C` par
défaut de Grist). À lancer **une fois** avant le premier `export:grist --push`.

## CLI & configuration

`pnpm nx run @tee-backoffice/format-adapters:export:grist`

Par défaut **dry run** : projette, écrit le snapshot
`static/exports/grist-records.json`, affiche le récap des schémas satisfaits.
**Aucune écriture Grist** sans `--push`.

Push (`… export:grist -- --push`, ou `GRIST_PUSH=1` en CI) : upsert REST sur la
clé `slug`. Variables d'environnement (jamais commitées, lues depuis `.env`) :

| Variable | Rôle | Défaut |
|---|---|---|
| `GRIST_BASE_URL` | instance Grist | `https://grist.numerique.gouv.fr` |
| `GRIST_DOC_ID` | document cible | — (requis) |
| `GRIST_TABLE_ID` | table cible | — (requis) |
| `GRIST_API_KEY` | clé API | — (requis) |

La table Grist porte les colonnes du schéma **entreprise** (l'`id` Etalab sous
`rnasp_id`) + `slug` + `technical`.

## Régénération du store sans Payload (`import:tee`)

`pnpm nx run @tee-backoffice/format-adapters:import:tee` reconstruit le store
canonical **directement depuis `static/input/programs.json`**, sans Payload :
`TeeImporter` mappe chaque dispositif, `SlugCanonicalId` lui donne un id stable
dérivé du slug (cuid2 déterministe — diff `canonical.db` minimal d'un jour à
l'autre), `date_mise_a_jour` = heure du run, puis `CanonicalProgramService.save`
valide + upsert. Les invalides sont ignorés et listés.

**Redirections** (`static/input/redirects.json`, fallback `redirects-tests.json`) :
après l'import, `ProgramRedirects` lit la table `program_redirects` (ancien slug
→ slug courant) et `RedirectTombstoneBuilder` transforme chaque redirection en
dispositif `remplace`. L'ancien dispositif ayant en général disparu de
`programs.json`, un **tombstone** est synthétisé en clonant le contenu de la
cible sous l'ancien slug, avec `statut_dispositif = remplace` et `remplace_par` =
id de la cible (résolu en slug à l'export). AGIR sert alors l'ancien slug avec
`statut: remplace` + le nouveau slug (redirection suivable) ; ces tombstones
**n'entrent pas** dans l'export Grist (`SchemaExportPolicy` filtre `remplace`).
Les redirections dont la cible est absente, ou dont l'ancien slug n'est pas un
slug canonical valide (apostrophes), sont ignorées/journalisées, jamais en
silence.

L'import lit `static/input/programs.json` (copie **vivante** amont, écrasée par le
workflow) et retombe sur `static/input/programs-tests.json` (copie **figée**,
fixture du round-trip) si la première est absente — un run local fonctionne donc
sans `fetch` préalable.

⚠️ Pour une régénération **propre** (suppressions amont reflétées), supprimer
`libs/canonical-store/canonical.db` avant l'import (le workflow le fait). Comme
`TeeImporter` marque tout en `pret_prod`/`valide`, ce store contient **tout**
l'amont (~234), plus large que le store alimenté par le CMS (~180, filtré par le
workflow éditorial Payload). C'est voulu : ce chemin traite l'amont
`programs.json` comme source de vérité du flux open data.

## Pipeline quotidien (GitHub Action)

`.github/workflows/daily_data.yml` (`schedule` quotidien + `workflow_dispatch`) :

1. récupère `programs.json` **et** `redirects.json` amont
   (betagouv/mission-transition-ecologique) → `static/input/` ;
2. `rm` le store puis `import:tee` (régénération fraîche + tombstones de
   redirection) ;
3. `setup:grist` (idempotent) puis `export:grist` avec `GRIST_PUSH=1` ;
4. commit de `programs.json` + `redirects.json` + `canonical.db` rafraîchis.

**Secrets GitHub requis** (Settings → Secrets and variables → Actions) :
`GRIST_BASE_URL` (⚠️ obligatoire ici — l'instance n'est pas celle par défaut),
`GRIST_DOC_ID`, `GRIST_TABLE_ID`, `GRIST_API_KEY`. Le job a `permissions:
contents: write` pour committer ; si `main` est protégée contre les pushes
directs, passer le commit en pull request ou autoriser le bot.
