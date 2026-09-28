# Feature 006 : Groupes d'opérateurs, logos et images des projets

**ADR :** à créer, `0013-operator-groups-and-media.md` (groupes d'opérateurs, médias importés depuis l'amont)
**Complète :** [ADR 0012](../adr/0012-production-persistence-postgres.md) §7 (uploads `Media` sur Scaleway Object Storage), [ADR 0003](../adr/0003-projects-collection.md) (champ `image` des projets), [feature 005](005-cms-daily-sync.md) (source amont, seed)

---

## Contexte

Le front TEE (dépôt `betagouv/mission-transition-ecologique`) affiche pour chaque dispositif le **logo de son opérateur de contact** et, pour chaque projet, une **image**. Le back-office n'a aucune de ces données : les fichiers restent dans le dépôt amont, et le stockage objet Scaleway, branché le 2026-09-28, n'est alimenté par rien.

Côté amont, les opérateurs sont décrits par `apps/nuxt/src/public/json/operator/operators.json`, généré depuis la table Opérateurs de Baserow (`libs/data/src/operators/operatorFeatures.ts`) :

```json
{ "operator": "Opco Akto", "filterCategories": ["OPCO"], "imagePath": "/images/logos/operateur/opco-akto.webp", "color": "green" }
```

Constats (vérifiés le 2026-09-28 sur l'amont et sur `static/upstream/`) :

| # | Constat | Conséquence |
|---|---|---|
| 1 | L'amont regroupe les opérateurs en **12 groupes** (`filterCategories`, colonne « Filtre » de Baserow) : Régions (14), OPCO (11), Opérateurs nationaux (9), CMA (6), CCI (5), Agence de l'eau (4), Organismes professionnels (4), Opérateurs territoriaux (3), État (3), OFB/ARB (2), ADEME (1), Bpifrance (1). 5 opérateurs n'ont aucun groupe | Le groupe est une donnée métier que le back-office ne porte pas |
| 2 | Relation **plusieurs-à-plusieurs** : « CCI ou CMA » appartient à CCI **et** à CMA | Un parent unique ne suffit pas |
| 3 | Côté front, le groupe ne sert **qu'au filtre « Opérateur »** de la liste des dispositifs (`programFilter.ts`, `byOperator`) | Pas d'effet sur l'affichage d'un dispositif |
| 4 | Le logo se résout sur le **nom exact** de l'opérateur de contact (`ProgramCard.vue`, `ProgramImage.vue`), **sans héritage du groupe** : les 11 OPCO ont chacun leur logo ; « Agence de l'Eau » a un logo, pas les 3 agences régionales | Le logo est porté par l'opérateur |
| 5 | 45 opérateurs sur 67 ont un logo (53 fichiers dans `images/logos/operateur/`, dont 8 inutilisés). Sans logo, le front retombe sur l'illustration du dispositif (22 opérateurs, environ 45 dispositifs) | Des opérateurs restent sans logo : cas normal, pas une erreur |
| 6 | Les 67 opérateurs de `operators.json` et les 67 cités par `programs.json` correspondent **exactement par leur nom** | Rapprochement par nom fiable, pas de table d'alias |
| 7 | 91 projets, 91 images distinctes (`/images/projet/*.webp`). `Projects.image` est un **texte** qui recopie ce chemin | Aucun fichier dans le back-office |
| 8 | Aucune notion de groupe dans notre système : `Operators` = `name`, `slug`, `contactUrl` ; `nom_normalise` du canonical jamais rempli ; seule trace, l'heuristique en dur `CCI_CMA_MARKER` de l'export Grist | À construire |
| 9 | `Media.alt` est obligatoire, `Media` est lisible publiquement | L'import doit fournir un texte alternatif |

**Hors scope :**
- Implémentation de l'exposition dans l'API AGIR : **conçue dans l'ADR 0013** (section dédiée), réalisée dans une feature ultérieure.
- Export Grist / open data : à décider plus tard.
- Illustrations des dispositifs (`illustration` du canonical) : l'amont ne s'en sert plus que comme image de secours.
- Champ `color` d'`operators.json` : présentation propre au front amont.
- Rafraîchissement d'un logo modifié en amont sous le même nom de fichier (voir « Questions ouvertes »).
- Branchement sur la sync quotidienne du CMS : dépend du lot 4 de la feature 005, qui réutilisera les importeurs créés ici.

---

## Décisions prises

| Sujet | Décision |
|---|---|
| Modèle des groupes | **Option B** (validée le 2026-09-28) : collection `operator-groups` (`name`, `slug`, `logo` optionnel) et relation `groups` (`hasMany`) sur `Operators`. Écartées : un `select hasMany` (vocabulaire figé dans le code) et un opérateur parent (ne gère pas « CCI ou CMA ») |
| Logo des opérateurs | Champ `logo` (`upload` vers `media`) sur `Operators`, optionnel |
| Logo des groupes | Champ `logo` sur `operator-groups`, utilisé **en secours** (validé le 2026-09-28) : un opérateur sans logo prend celui de son groupe. Écart assumé avec le front amont, qui retombe sur l'illustration du dispositif |
| Logo effectif | `OperatorLogoResolver` : logo de l'opérateur, sinon logo du premier de ses groupes (dans l'ordre amont) qui en a un, sinon aucun. Seul point de résolution, réutilisé par l'exposition AGIR |
| Alimentation des logos de groupe | L'amont n'a pas de logo de groupe, mais certains groupes ont un opérateur « générique » qui en a un. Table explicite `OperatorGroupLogoDefaults` (groupe → chemin amont) : Agence de l'eau → `agence-de-l-eau.webp`, CCI → `cci.webp`, CMA → `cma.webp`, ADEME → `ademe.webp`, Bpifrance → `bpi.webp`. Les autres groupes restent sans logo, modifiables dans l'admin. L'import ne remplace pas un logo de groupe posé à la main. Bénéfice : les 3 agences de l'eau, 3 CCI et 4 CMA régionales sans logo en obtiennent un |
| Exposition AGIR | **Prévue dans l'ADR 0013**, non implémentée ici : groupes et logo effectif portés par l'opérateur dans le canonical, puis projetés dans `DetailDispositif` et `AdemePivot` (voir « Contenu attendu de l'ADR 0013 ») |
| Image des projets | `Projects.image` passe de `text` à `upload` vers `media` |
| Source des opérateurs | `operators.json` amont, lu par `UpstreamJsonSource` comme les autres fichiers (URL surchargeable `TEE_OPERATORS_URL`, copie versionnée dans `static/upstream/`, rafraîchie par `pnpm data:snapshot`) |
| Source des fichiers | Téléchargement HTTP depuis le dossier public du front amont (`raw.githubusercontent.com/.../main/apps/nuxt/src/public` + chemin amont), base surchargeable `TEE_ASSETS_BASE_URL`, même timeout réseau que les JSON |
| Identité d'un média importé | Nouveau champ `sourcePath` sur `Media` (chemin amont, unique, lecture seule, vide pour un upload manuel). L'import retrouve un média par ce chemin avant tout téléchargement : relancer le seed ne crée ni doublon ni nouvel objet dans le bucket, même si Payload a renommé le fichier |
| Rapprochement opérateurs | Par nom exact (`operator` amont = `name` CMS, via le slug déjà utilisé par `OperatorImporter`) |
| Opérateur amont absent du CMS | **Signalé**, pas créé : le CMS ne crée que les opérateurs cités par au moins un dispositif |
| Texte alternatif | `Logo de <nom de l'opérateur>` ; pour un projet, son titre |
| Anomalies | Logo ou image introuvable (404), opérateur sans correspondance : **signalés en fin de seed**, sans faire échouer le seed (même principe que les données que Payload ne sait pas porter) |
| Repli local (`TEE_UPSTREAM_LOCAL_FALLBACK`) | Les images **ne sont pas versionnées** dans `static/upstream/` : en repli, le rattachement aux groupes se fait depuis la copie de `operators.json`, les téléchargements échouent et sont signalés |
| Écritures | Via `SystemWorkflowContext`, comme le reste du seed. Les téléchargements et créations de médias sont **séquentiels** (même prudence que `LinkedProjectsUpdater` sur les deadlocks) |

---

## Fichiers à créer / modifier

| Fichier | Action |
|---|---|
| `apps/cms/src/collections/OperatorGroups.ts` | Créer : collection `operator-groups` (`name` unique, `slug` unique, `logo` upload optionnel), masquée hors admins comme `Operators`, écriture réservée au super-admin |
| `apps/cms/src/collections/Operators.ts` | Modifier : champs `groups` (relation `hasMany` vers `operator-groups`) et `logo` (upload vers `media`) ; colonnes de liste |
| `apps/cms/src/collections/Projects.ts` | Modifier : `image` en `upload` vers `media` |
| `apps/cms/src/collections/Media.ts` | Modifier : champ `sourcePath` (texte, unique, lecture seule, sidebar) |
| `apps/cms/src/services/access/OperatorGroupAccessPolicy.ts` | Créer si les règles diffèrent d'`OperatorAccessPolicy`, sinon réutiliser |
| `apps/cms/payload.config.ts` | Modifier : enregistrer `OperatorGroups` ; plugin `s3Storage` avec `acl: 'public-read'` et `disablePayloadAccessControl: true` sur `media` (dès cette feature, pour que les fichiers importés par le seed soient publics d'emblée, sans ré-upload) |
| `libs/format-adapters/src/tee/UpstreamJsonSource.ts` | Modifier : `operators()` (lecture + repli local), `TEE_OPERATORS_URL` |
| `libs/format-adapters/src/tee/tee-operator.schema.ts` | Créer : schéma zod d'une entrée d'`operators.json` (`operator`, `filterCategories`, `imagePath?`, `color?`) |
| `libs/format-adapters/src/tee/UpstreamAssetSource.ts` | Créer : téléchargement d'un fichier amont par chemin (`fetch` injectable, timeout, `UpstreamFetchError` avec statut HTTP) |
| `libs/format-adapters/scripts/snapshot-upstream.ts`, `static/upstream/operators.json` | Modifier / créer : copie versionnée d'`operators.json` |
| `apps/cms/src/scripts/seed/media/UpstreamMediaImporter.ts` | Créer : `findOrCreate(sourcePath, alt)` → id du média ; cherche par `sourcePath`, sinon télécharge et crée ; collecte les avertissements |
| `apps/cms/src/scripts/seed/programs/OperatorGroupImporter.ts` | Créer : upsert des groupes par slug depuis `operators.json` → nom de groupe vers id |
| `apps/cms/src/services/operators/OperatorLogoResolver.ts` | Créer : logo effectif (opérateur, sinon groupe), tests unitaires |
| `apps/cms/src/scripts/seed/programs/OperatorGroupLogoDefaults.ts` | Créer : table groupe → chemin amont du logo générique |
| `apps/cms/src/scripts/seed/programs/OperatorProfileImporter.ts` | Créer : pour chaque opérateur amont, rattache ses groupes et son logo à l'opérateur CMS correspondant ; signale les opérateurs sans correspondance |
| `apps/cms/src/scripts/seed/programs/index.ts` (`ProgramsSeed`) | Modifier : groupes et profils des opérateurs après `OperatorImporter` |
| `apps/cms/src/scripts/seed/projects/ProjectMapper.ts`, `types.ts`, `ProjectsSeed` | Modifier : `image` résolue en id de média via `UpstreamMediaImporter` |
| `apps/cms/src/scripts/seed/run.ts` | Modifier : instancier `UpstreamAssetSource` depuis les réglages, afficher les avertissements médias |
| `apps/cms/src/migrations/` | Créer : table `operator_groups`, `operators_rels` (groupes), `operators.logo_id`, `media.source_path`, `projects.image_id` à la place de `projects.image` (et tables `_v` des projets) |
| `apps/cms/payload-types.ts`, `importMap.js` | Régénérer |
| `apps/cms/.env.example` | Modifier : `TEE_OPERATORS_URL`, `TEE_ASSETS_BASE_URL` (commentées) |
| `apps/cms/tests/` | Créer : tests unitaires et d'intégration (voir « Vérification ») |
| `docs/adr/0013-operator-groups-and-media.md`, `docs/adr/0012-*.md` §7, `docs/adr/0003-*.md`, `docs/context/seed.md`, `CLAUDE.md` | Créer / modifier |
| `docs/features/TASKS.md` | Modifier : ligne 006 |

---

## Étapes d'implémentation

### Lot 1 : source amont
1. Schéma zod `tee-operator.schema.ts` et `UpstreamJsonSource.operators()`, avec repli local et tests (fixture, 404, JSON invalide).
2. `UpstreamAssetSource` : téléchargement d'un chemin amont, `fetch` injectable, erreurs typées, tests.
3. `operators.json` ajouté au snapshot (`pnpm data:snapshot`) et commité dans `static/upstream/`.

### Lot 2 : modèle Payload
1. Collection `OperatorGroups`, champs `groups` et `logo` sur `Operators`, `sourcePath` sur `Media`, `image` en upload sur `Projects`.
2. Migration générée sur une base vierge (`pnpm migrate:create operator_groups_and_media`), `payload-types.ts`, import map.
3. La base de dev doit être remise à zéro (`pnpm db:reset`, puis `pnpm seed`) : le changement de type de `Projects.image` casse les lignes existantes. En prod et préprod, la migration perd les chemins texte, que le seed suivant remplace par les médias.

### Lot 3 : import
1. `UpstreamMediaImporter` (recherche par `sourcePath`, téléchargement, création, avertissements), tests d'intégration avec un `fetch` factice et le stockage disque.
2. `OperatorGroupImporter` (avec les logos de `OperatorGroupLogoDefaults`, sans écraser un logo posé à la main) puis `OperatorProfileImporter` dans `ProgramsSeed`.
3. `OperatorLogoResolver` et ses tests (logo propre, secours par groupe, opérateur multi-groupe, aucun logo).
4. Images des projets dans `ProjectsSeed`.
5. Avertissements en fin de seed (fichiers introuvables, opérateurs sans correspondance), sans code de sortie non nul.

### Lot 4 : documentation
1. ADR 0013 (voir ci-dessous), avenant ADR 0012 §7 (le stockage objet est alimenté par le seed), ADR 0003 (`image`), `docs/context/seed.md`, `CLAUDE.md` (collections, seed, variables).

### Contenu attendu de l'ADR 0013
1. Modèle : collection `operator-groups`, relation plusieurs-à-plusieurs, options écartées.
2. Médias importés : `sourcePath`, idempotence, source amont, repli local.
3. Logo effectif : règle de secours par groupe, écart avec le front amont, table `OperatorGroupLogoDefaults`.
4. **Exposition AGIR (prévue, non implémentée)** :
   - canonical : `operateurSchema` gagne `groupes` (noms des groupes) et `logo` (URL du logo effectif, avec son origine `operateur` ou `groupe`), optionnels ;
   - `ProgramCanonicalMapper` les remplit via `OperatorLogoResolver` ; `TeeImporter` les laisse vides (l'import sans Payload n'a pas les médias) ;
   - `AgirDetailExporter` et `AdemePivotExporter` les projettent ; vocabulaire et forme exacte à valider avec l'équipe AGIR ;
   - **URL servie par le bucket** (décidé le 2026-09-28), le bucket étant **lisible publiquement en lecture seule** : lecture d'un objet ouverte à tous, pas de listing, écriture réservée à la clé du back-office. L'URL du bucket ne dépend pas du back-office, ce qui va dans le sens de l'ADR 0008 (anti-lock-in) ;
   - méthode retenue : **ACL `public-read` par objet**, posée à l'upload par le plugin (`acl: 'public-read'` de `s3Storage`), bucket laissé privé, sans bucket policy. Une bucket policy a été écartée : elle retire l'accès à tout principal qu'elle ne cite pas, IAM compris, et une erreur couperait l'écriture du back-office. Côté Payload, en plus : `disablePayloadAccessControl: true` sur `media`, pour que l'URL générée pointe sur le bucket. Pas de perte de contrôle d'accès : `Media` est déjà lisible par tous. Conséquence : **tout fichier de `Media` est public** ; un futur média confidentiel demanderait une collection d'upload séparée ;
   - vérifié le 2026-09-28 sur `tee-backoffice-media-pre-prod` (script de contrôle, objet de test supprimé ensuite) : lecture anonyme 200, listing anonyme 403, `PUT` et `DELETE` anonymes 403, écriture et suppression par la clé du back-office OK. **Limite** : une ancienne version reste lisible anonymement avec son `versionId` (200), l'ACL étant portée par chaque version. Risque faible : un `versionId` n'est pas devinable et ne s'obtient qu'en listant les versions, ce qui est refusé aux anonymes. À réduire par la règle de cycle de vie qui expire les versions non courantes ;
   - les fichiers uploadés avant l'activation de l'ACL restent privés : à ré-uploader, ou à passer en public depuis la console ;
   - **repli** si la lecture seule publique est abandonnée : URL servie par le back-office (`/api/media/file/<fichier>`), bucket privé, base de l'URL absolue construite par les endpoints AGIR comme leurs autres liens (`PUBLIC_BASE_URL`, sinon `req.origin`). C'est aussi le cas sans stockage objet (dev local : URL relative, préfixée par les endpoints) ;
   - contrôles à refaire sur le bucket de prod : `GET` anonyme d'un objet → 200 ; `GET` anonyme de la racine du bucket (listing) → 403 ; `PUT` et `DELETE` anonymes → 403 ; écriture et suppression par la clé du back-office → OK ;
   - le groupe dans le canonical pourra remplacer l'heuristique `CCI_CMA_MARKER` de l'export Grist.
5. Export Grist / open data : non décidé.

---

## Vérification

```sh
pnpm test:unit
pnpm test                          # intégration (tee_test)
pnpm nx affected -t lint typecheck
pnpm db:reset && pnpm db:up && pnpm seed
pnpm seed                          # second passage : aucun nouveau média
```

Contrôles attendus :
- 12 groupes ; « CCI ou CMA » rattaché à CCI et CMA ; 11 opérateurs dans OPCO ; 5 opérateurs sans groupe.
- 45 opérateurs avec un logo propre, 22 sans, sans avertissement pour ces derniers.
- 5 groupes avec un logo ; logo effectif présent pour 55 opérateurs (45 + 10 par secours de groupe).
- 91 projets avec une image.
- Environ 136 médias (45 logos + 91 images de projets) ; un second `pnpm seed` n'en crée aucun.
- **Bucket en lecture seule publique** (si retenu) : contrôles de l'ADR 0013, point 4, sur chaque bucket.
- **Test du stockage objet** : avec les variables `S3_*` du `.env` (bucket de dev ou de préprod), les fichiers apparaissent dans l'onglet « Fichiers » du bucket et s'affichent dans l'admin ; sans ces variables, ils vont sur le disque local.
- Avec `TEE_UPSTREAM_LOCAL_FALLBACK=1` et GitHub injoignable : groupes rattachés, téléchargements signalés, seed terminé.

---

## Questions ouvertes

- **Rafraîchissement des logos** : un logo remplacé en amont sous le même nom de fichier n'est pas réimporté (le média existe déjà pour ce `sourcePath`). L'amont publie les dates de téléchargement dans `libs/data/static/operator_images_download_info.json` et `project_images_download_info.json` : à exploiter si le besoin apparaît.
- **Export Grist / open data** des groupes et logos : à décider plus tard.
