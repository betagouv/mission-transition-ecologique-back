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

> **Outil de secours depuis le 2026-10-02.** Le pipeline quotidien n'appelle plus `import:tee` ni `import:projects` : il synchronise le CMS, et le store suit par les hooks (voir « Pipeline quotidien » plus bas). Ces deux imports restent utilisables pour reconstruire un store sans Payload ; le rapprochement de la sync suivante retirera du store ce que le CMS n'y attend pas.

`pnpm nx run @tee-backoffice/format-adapters:import:tee` reconstruit le store
canonical **directement depuis `static/input/programs.json`**, sans Payload :
`TeeImporter` mappe chaque dispositif, `SlugCanonicalId` lui donne un id stable
dérivé du slug (cuid2 déterministe : diff minimal d'un jour à
l'autre), `date_mise_a_jour` = heure du run, puis
`CanonicalProgramService.applySnapshot` aligne le store sur ce snapshot (voir
plus bas). Les invalides sont ignorés et listés.

**Redirections** (`static/input/redirects.json`, fallback `redirects-tests.json`) :
après l'import, `ProgramRedirects` lit la table `program_redirects` (ancien slug
→ slug courant) et `RedirectTombstoneBuilder` transforme chaque redirection en
dispositif `remplace`. L'ancien dispositif ayant en général disparu de
`programs.json`, un **tombstone** est synthétisé en clonant le contenu de la
cible sous l'ancien slug, avec `statut_dispositif = remplace` et `remplace_par` =
id de la cible (résolu en slug à l'export). AGIR sert alors l'ancien slug avec
`statut: remplace` + le nouveau slug (redirection suivable) ; ces tombstones
**n'entrent pas** dans l'export Grist (`SchemaExportPolicy` filtre `remplace`).
Les redirections dont la cible est absente sont ignorées et journalisées, jamais
en silence. Un ancien slug hors kebab-case (apostrophe droite ou typographique,
majuscule, ex. `contrat-3S-occitanie`) est **conservé tel quel** : le canonical
l'accepte sur un dispositif `remplace` uniquement, et AGIR l'encode dans ses URLs
(`encodeURIComponent`), si bien que toutes les redirections amont sont servies.

`TeeImporter` retire aussi les chevrons d'autolien markdown autour d'une URL amont
(`<https://…>`), qui faisaient rejeter le dispositif à la validation.

L'import lit `static/input/programs.json` (copie **vivante** amont, écrasée par le
workflow) et retombe sur `static/input/programs-tests.json` (copie **figée**,
fixture du round-trip) si la première est absente — un run local fonctionne donc
sans `fetch` préalable.

L'import **aligne** le store sur l'amont sans jamais le vider
(`CanonicalProgramService.applySnapshot`) :

1. une entrée dont le slug est déjà stocké sous un autre id (id aléatoire écrit
   par le CMS) reprend **l'id stocké**, et les références amont vers l'id dérivé
   sont réécrites (`CanonicalIdentityMap`) ; puis toutes les entrées (dispositifs
   + tombstones) sont validées avant toute écriture ;
2. `CanonicalSnapshotPlan` compare aux lignes stockées (`listKeys`, lignes
   illisibles comprises) : upsert des dispositifs valides, suppression de ceux
   **absents de l'amont**, et **conservation** de la ligne d'un dispositif dont
   l'entrée amont est invalide ;
3. `CanonicalSnapshotGuard` refuse le snapshot, store inchangé et code de sortie
   non nul (la suite de `data:daily`, dont le push Grist, ne tourne pas), s'il ne
   contient aucun dispositif valide ou s'il retirerait plus de
   `max(5, 10 % du store)` dispositifs. `--allow-mass-removal` lève ce plafond
   pour un nettoyage amont volontaire ;
4. suppressions puis upserts sont appliqués dans **une transaction**
   (`applyChanges`) : tout passe, ou rien.

Comme `TeeImporter` marque tout en `pret_prod`/`valide`, ce store
contient **tout** l'amont (~280), plus large que le store alimenté par le CMS
(filtré par le workflow éditorial Payload). C'est voulu : ce chemin traite
l'amont `programs.json` comme source de vérité du flux open data.

## Pipeline quotidien (tâche planifiée Scalingo)

`cron.json` à la racine lance `pnpm data:daily` chaque nuit (03h17 UTC) dans un
conteneur one-off de l'application. La commande appelle les scripts en `tsx`
direct, **sans nx** : `nx` est une devDependency (absente du conteneur de prod),
`tsx` une dépendance de prod. Aucun `.env` n'est lu, les variables viennent de
Scalingo. En local, lancer **`pnpm data:daily:dev`** : même enchaînement via les
targets nx, qui chargent le `.env` racine (voir `.env.example`). Les scripts
résolvent leurs chemins (`static/input/`, `static/exports/`) depuis leur propre
fichier : le résultat ne dépend pas du répertoire de lancement.

Flux (depuis le 2026-10-02, feature 005 lot 4) : **amont → CMS → canonical →
Grist**. Le store canonical n'est plus écrit directement : il reçoit ce que les
hooks du CMS lui envoient.

Étapes :

1. `pnpm data:sync` (`apps/cms/src/scripts/sync/run.ts`, classe `UpstreamSync`,
   la commande que le seed utilise aussi) :
   - lecture HTTP de `programs.json`, `projects.json`, `operators.json` et
     `redirects.json` amont (`UpstreamJsonSource`), avant le démarrage de Payload :
     un amont injoignable fait échouer la tâche sans rien écrire ;
   - écriture des **dispositifs** puis des **projets** dans Payload, redirections
     comprises (un ancien slug devient un document `remplace`). Un document dont
     l'empreinte (`upstreamFingerprint`) n'a pas changé n'est pas réécrit ;
   - **annulation** des dispositifs et projets importés qui ont disparu de
     l'amont sans redirection (`annule`), sous garde-fou : au-delà de
     `max(5, 10 %)` des documents importés, rien n'est annulé et la tâche sort
     en erreur (`pnpm data:sync --allow-mass-removal` lève le plafond) ;
   - **rapprochement** CMS ↔ canonical (`CanonicalReconciler`) : une ligne
     attendue absente du store est une erreur, une ligne que le CMS n'attend
     pas est retirée.
2. `pnpm data:grist` : `grist-setup` (idempotent) puis `export:grist --push`,
   pour les **dispositifs** seulement. Les projets n'entrent pas dans l'export
   Grist.

L'export Grist tourne **même si la sync a signalé des erreurs** : il publie ce
que le store contient. La tâche sort en code non nul si l'une des deux étapes a
échoué. Un enregistrement de `projects.json` dont la forme est cassée n'arrête
rien : il est écarté, listé dans le compte rendu, compté comme erreur, et son
projet est conservé tel quel dans le CMS.

Compte rendu d'une sync sans changement amont (2026-10-02, base jetable) :

```
Programs complete: 0 created, 0 updated, 290 unchanged, 0 errors.
Redirections : 1 dispositif(s) marqué(s) en place, 12 remplacé(s) cloné(s), 0 ignorée(s).
Pass 1 complete: 0 created, 0 updated, 97 unchanged, 0 errors.
Redirections : 0 projet(s) marqué(s) en place, 6 remplacé(s) cloné(s), 0 ignorée(s).
Rapprochement CMS ↔ canonical : aucun écart restant.
```

Aucun commit de données : le store vit dans PostgreSQL (schéma `canonical`), plus
dans un fichier du dépôt. L'ancien `.github/workflows/daily_data.yml` a été
supprimé (ADR 0012).

**Variables requises sur l'app Scalingo** : `GRIST_BASE_URL` (⚠️ obligatoire ici,
l'instance n'est pas celle par défaut), `GRIST_DOC_ID`, `GRIST_TABLE_ID`,
`GRIST_API_KEY`, éventuellement `TEE_PROGRAMS_URL` / `TEE_PROJECTS_URL` / `TEE_REDIRECTS_URL`.

**Surveillance** : les logs partent dans ceux de l'application (`scalingo logs`),
les tâches se listent avec `scalingo cron-tasks`. Scalingo ne notifie pas l'échec
d'une tâche : **aucune alerte n'est en place à ce jour**. C'est le prochain
chantier (Sentry envisagé) ; le code de sortie non nul de `data:daily` et le
compte rendu de la sync en sont les points d'accroche.
