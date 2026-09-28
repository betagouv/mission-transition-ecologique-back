# Feature 006 : Groupes d'opérateurs, logos et images des projets

**Statut :** implémentée le 2026-09-28 (lots 1 à 4), branche `feat/operator-groups-and-logos`. Reste à faire à la main : `TEE_OPERATORS_URL` et `TEE_ASSETS_BASE_URL` (commentées) dans `apps/cms/.env.example`, que l'outillage ne peut pas modifier. Exposition AGIR : conçue, non implémentée (feature ultérieure).
**ADR :** [`0013-operator-groups-and-media.md`](../adr/0013-operator-groups-and-media.md) (groupes d'opérateurs, médias importés depuis l'amont)
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
| Identité d'un média importé | Nouveau champ `sourcePath` sur `Media` (chemin amont, unique, vide pour un upload manuel), masqué dans l'admin et verrouillé par l'API comme `canonicalId` (seul le seed, en Local API, le renseigne). L'import retrouve un média par ce chemin avant tout téléchargement : relancer le seed ne crée ni doublon ni nouvel objet dans le bucket, même si Payload a renommé le fichier |
| Typologie des médias | Champ `category` (« Type », obligatoire) : `operator-logo` ou `project-image` (`mediaCategoryOptions.ts`). Les sélecteurs `Operators.logo` et `OperatorGroups.logo` ne proposent et n'acceptent que des logos d'opérateurs, `Projects.image` que des images de projets (`filterOptions`, vérifié aussi à l'enregistrement) |
| Écriture des médias | Réservée aux admins et super-admins (`AuthAccessPolicy.isAdmin`), lecture publique |
| Rapprochement opérateurs | Par nom exact (`operator` amont = `name` CMS, via le slug déjà utilisé par `OperatorImporter`) |
| Opérateur amont absent du CMS | **Signalé**, pas créé : le CMS ne crée que les opérateurs cités par au moins un dispositif |
| Texte alternatif | `Logo de <nom de l'opérateur>` ; pour un projet, son titre |
| Anomalies | Logo ou image introuvable (404), opérateur sans correspondance : **signalés en fin de seed**, sans faire échouer le seed (même principe que les données que Payload ne sait pas porter) |
| Repli local (`TEE_UPSTREAM_LOCAL_FALLBACK`) | Les images **ne sont pas versionnées** dans `static/upstream/` : en repli, le rattachement aux groupes se fait depuis la copie de `operators.json`, les téléchargements échouent et sont signalés |
| Écritures | Via `SystemWorkflowContext`, comme le reste du seed. Les téléchargements et créations de médias sont **séquentiels** (même prudence que `LinkedProjectsUpdater` sur les deadlocks) |

---

## Fichiers créés / modifiés

État réel à l'implémentation (2026-09-28).

| Fichier | Action |
|---|---|
| `libs/format-adapters/src/tee/tee-operator.schema.ts` | Créé : `teeOperatorSchema` / `teeOperatorsSchema` / `TeeOperator` (`operator`, `filterCategories` par défaut `[]`, `imagePath?`, `color?`) |
| `libs/format-adapters/src/tee/UpstreamFile.ts` | Modifié : `operators` ajouté à `UPSTREAM_FILES` |
| `libs/format-adapters/src/tee/UpstreamJsonSource.ts` | Modifié : `operators()` (lecture validée par zod, même repli local), URL par défaut `apps/nuxt/src/public/json/operator/operators.json`, `TEE_OPERATORS_URL` ; une variable `TEE_*_URL` vide retombe désormais sur le défaut |
| `libs/format-adapters/src/tee/UpstreamAsset.ts` | Créé : forme d'un fichier téléchargé (`data`, `mimetype`, `name`, `size`), celle du `file` de `payload.create` |
| `libs/format-adapters/src/tee/UpstreamAssetSource.ts` | Créé : téléchargement par chemin amont (base `raw.githubusercontent.com/.../main/apps/nuxt/src/public`, `TEE_ASSETS_BASE_URL`, `fetch` injectable, timeout 30 s, `UpstreamFetchError`), type MIME par `content-type` `image/*` sinon par extension, garde sur les chemins (`..`, `\`, `%2e`, chemin non enraciné) |
| `libs/format-adapters/src/index.ts` | Modifié : exports des trois fichiers ci-dessus |
| `libs/format-adapters/src/tee/UpstreamAssetSource.spec.ts`, `UpstreamJsonSource.spec.ts` | Créé / modifié : tests (téléchargement, base par défaut, statut d'erreur, type MIME, chemins refusés ; `operators()`, 404, JSON invalide, repli) |
| `libs/format-adapters/scripts/snapshot-upstream.ts`, `static/upstream/operators.json` | Modifié / créé : copie versionnée d'`operators.json` (67 entrées), produite par `pnpm data:snapshot` |
| `apps/cms/src/collections/OperatorGroups.ts` | Créé : collection `operator-groups` (`name` et `slug` uniques, `logo` upload optionnel filtré sur `operator-logo`), lecture `OperatorAccessPolicy.read`, écriture super-admin (`AuthAccessPolicy.isSuperAdmin`), masquée hors admins. Pas de `OperatorGroupAccessPolicy` : les politiques existantes suffisent |
| `apps/cms/src/collections/Operators.ts` | Modifié : `groups` (relation `hasMany` vers `operator-groups`), `logo` (upload vers `media`, filtré sur `operator-logo`), colonnes de liste `name`, `groups`, `logo` |
| `apps/cms/src/collections/Projects.ts` | Modifié : `image` en `upload` vers `media`, filtré sur `project-image` |
| `apps/cms/src/collections/Media.ts` | Modifié : `category` (« Type », `select` obligatoire), `sourcePath` (texte, unique, indexé, `admin.hidden`, accès de champ `create`/`update` refusé), écriture réservée aux admins, colonnes de liste `filename`, `alt`, `category`, `updatedAt`, recherche sur `filename` et `alt` |
| `apps/cms/src/constants/mediaCategoryOptions.ts` | Créé : `MEDIA_CATEGORY_OPTIONS` et type `MediaCategory` |
| `apps/cms/payload.config.ts` | Modifié : `OperatorGroups` enregistrée ; plugin `s3Storage` **toujours enregistré** (`enabled: Boolean(objectStorage)`, `alwaysInsertFields: true`), `acl: 'public-read'`, `disablePayloadAccessControl: true` sur `media` |
| `apps/cms/src/migrations/20260928_150255_operator_groups_and_media.{ts,json}`, `index.ts` | Créé / modifié (régénérée après la revue, jamais déployée avant) : type `enum_media_category` et `media.category` `NOT NULL` (médias existants passés en `project-image` avant la contrainte, retouche manuelle), `operator_groups`, `operators_rels`, `operators.logo_id`, `media.source_path`, `media.prefix`, `media._objectkey` (colonnes du plugin S3), `projects.image_id` à la place de `projects.image` (supprimée), `payload_locked_documents_rels.operator_groups_id`. `Projects` n'a pas de versions : pas de table `_v` |
| `apps/cms/src/scripts/seed/media/UpstreamMediaImporter.ts` | Créé : `findOrCreate(sourcePath, alt, category)`, type posé à la création et réaligné sur un média existant, statistiques créés/réutilisés/recatégorisés/en échec, avertissements, jamais d'exception sur un téléchargement |
| `apps/cms/src/scripts/seed/programs/OperatorGroupLogoDefaults.ts` | Créé : table groupe → chemin amont du logo générique (5 groupes) |
| `apps/cms/src/scripts/seed/programs/OperatorGroupImporter.ts` | Créé : upsert des groupes par slug, logo par défaut sans écraser un logo existant |
| `apps/cms/src/scripts/seed/programs/OperatorProfileImporter.ts` | Créé : groupes et logo de chaque opérateur CMS, opérateurs amont sans correspondance signalés |
| `apps/cms/src/scripts/seed/programs/index.ts` (`ProgramsSeed`) | Modifié : paramètre optionnel `OperatorProfilesInput` (`operators` + `media`), groupes et profils après `OperatorImporter` |
| `apps/cms/src/scripts/seed/projects/ProjectMapper.ts`, `ProjectImporter.ts`, `index.ts` | Modifié : `map(project, imageId)`, image résolue par `ProjectImporter` via `UpstreamMediaImporter` (optionnel dans `ProjectsSeed`). `types.ts` inchangé |
| `apps/cms/src/scripts/seed/run.ts` | Modifié : `UpstreamAssetSource`, lecture d'`operators.json`, `UpstreamMediaImporter` partagé, récapitulatif (dont recatégorisés) et avertissements médias en fin de seed |
| `apps/cms/src/services/operators/OperatorLogoResolver.ts` | Créé : logo effectif (opérateur, sinon premier groupe qui en a un) avec son origine |
| `apps/cms/vitest.config.mts` | Modifié : `S3_BUCKET: ''`, les tests n'écrivent jamais dans un bucket réel |
| `apps/cms/tests/unit/OperatorLogoResolver.spec.ts` | Créé : logo propre, secours par groupe, ordre des groupes, aucun logo, références non peuplées |
| `apps/cms/tests/int/media-rules.int.spec.ts` | Créé : upload et modification refusés à un créateur, `sourcePath` ignoré quand un admin l'envoie par l'API (création et modification), logo d'opérateur ou de groupe refusé s'il pointe sur une image de projet |
| `apps/cms/tests/int/upstream-media.int.spec.ts` | Créé : création (type posé), réutilisation sans téléchargement, réalignement d'un type erroné, fichier manquant, chemin refusé |
| `apps/cms/tests/int/operator-profiles.int.spec.ts` | Créé : groupes, multi-groupe, logos, logos de groupe et d'opérateur posés à la main conservés, avertissements, idempotence, règles d'écrasement au second import (chemin amont changé : logo remplacé ; plus d'`imagePath` : logo retiré ; 404 : logo importé gardé). Nettoyage limité à ce que la spec crée |
| `apps/cms/tests/support/FakeAssetFetch.ts`, `tests/fixtures/operators.json`, `tests/fixtures/pixel.webp` | Créé : `fetch` factice et fixtures (`operators.json` : 8 entrées, dont 3 pour les règles d'écrasement des logos) |
| `apps/cms/payload-types.ts` | Régénéré (non versionné) ; `importMap.js` inchangé (aucun composant custom) |
| `apps/cms/.env.example` | **À faire à la main** : `TEE_OPERATORS_URL`, `TEE_ASSETS_BASE_URL` (commentées) ; l'outillage ne peut pas modifier les fichiers d'environnement |
| `docs/adr/0013-operator-groups-and-media.md` | Créé |
| `docs/adr/0012-*.md` §7, `docs/adr/0003-*.md` | Modifié : notes de révision datées |
| `docs/context/seed.md`, `projects-model.md`, `programs-model.md`, `CLAUDE.md` | Modifié |
| `docs/features/TASKS.md` | Modifié : ligne 006 |

---

## Étapes d'implémentation

### Lot 1 : source amont
1. Schéma zod `tee-operator.schema.ts` et `UpstreamJsonSource.operators()`, avec repli local et tests (fixture, 404, JSON invalide).
2. `UpstreamAssetSource` : téléchargement d'un chemin amont, `fetch` injectable, erreurs typées, tests.
3. `operators.json` ajouté au snapshot (`pnpm data:snapshot`) et commité dans `static/upstream/`.

### Lot 2 : modèle Payload
1. Collection `OperatorGroups`, champs `groups` et `logo` sur `Operators`, `sourcePath` et `category` sur `Media`, `image` en upload sur `Projects`, sélecteurs filtrés par type.
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
- **Bucket en lecture seule publique** (si retenu) : contrôles de l'ADR 0013, §6, sur chaque bucket.
- **Test du stockage objet** : avec les variables `S3_*` du `.env` (bucket de dev ou de préprod), les fichiers apparaissent dans l'onglet « Fichiers » du bucket et s'affichent dans l'admin ; sans ces variables, ils vont sur le disque local.
- Avec `TEE_UPSTREAM_LOCAL_FALLBACK=1` et GitHub injoignable : groupes rattachés, téléchargements signalés, seed terminé.

### Résultats (2026-09-28)

- Contrôles de code : lint, typecheck et build OK ; tests unitaires du CMS (120), d'intégration (57 après la revue) et de `format-adapters` (408) OK.
- Seed complet lancé deux fois sur une base jetable : 12 groupes, « CCI ou CMA » dans CCI et CMA, 11 opérateurs dans OPCO, 45 opérateurs avec un logo propre, 55 avec un logo effectif, 5 groupes avec un logo, 91 projets sur 91 avec une image, 136 médias au premier passage et toujours 136 au second (0 créé, 136 réutilisés), code de sortie 0, aucun avertissement média, les 67 opérateurs amont rapprochés.
- Non vérifié ici : le repli `TEE_UPSTREAM_LOCAL_FALLBACK=1` avec GitHub injoignable, et les contrôles d'ACL sur le bucket de prod (ADR 0013 §6).

---

## Écarts constatés à l'implémentation

- **14 opérateurs sans groupe dans le CMS, et non 5.** Aux 5 opérateurs sans groupe en amont s'ajoutent 9 CMA régionales citées par des dispositifs mais **absentes d'`operators.json`** : CMA Bretagne, Centre-Val de Loire, Corse, Grand-Est, La Réunion, Normandie, Nouvelle-Aquitaine, Pays-de-la-Loire, Provence-Alpes-Côte-D'Azur. Elles n'ont ni groupe ni logo de secours CMA. Le constat n° 6 (67 = 67) ne vaut donc que pour la liste amont et les opérateurs de contact : `OperatorImporter` crée aussi les opérateurs cités comme autres opérateurs ou dans les variantes, qui peuvent manquer à `operators.json`. Piste : les signaler à l'amont (table Opérateurs de Baserow), ou les rattacher à la main, en sachant qu'un rattachement manuel reste en place tant que l'opérateur est absent d'`operators.json` (le seed ne touche que les opérateurs amont).
- **Colonnes du plugin S3 absentes des migrations locales.** Le plugin `s3Storage` n'ajoute `media.prefix` et `media._objectKey` que s'il est enregistré ; il ne l'était qu'avec un bucket configuré, donc une migration générée en local ne correspondait pas au schéma de préprod et de prod. Correction : plugin toujours enregistré (`enabled: Boolean(objectStorage)`, `alwaysInsertFields: true`), et la migration de cette feature ajoute les deux colonnes. Voir ADR 0012 §7 (révision) et ADR 0013 §5.
- **Règles d'écrasement précisées** (non prévues par le plan, voir ADR 0013 §4) : un logo d'opérateur uploadé à la main (média sans `sourcePath`) n'est jamais écrasé ; un logo importé suit l'amont et est retiré si l'amont n'a plus d'`imagePath` ; un téléchargement en échec garde le logo actuel ; les `groups` d'un opérateur sont remplacés par la liste amont à chaque seed (une modification manuelle est perdue).
- **`OperatorLogoResolver` exige `depth >= 2`** : un groupe resté à l'état d'id est ignoré. À respecter par l'exposition AGIR.
- **Variables `TEE_*_URL` vides** : une variable présente mais vide retombe désormais sur l'URL par défaut, au lieu de produire une URL vide.
- **Pas d'`OperatorGroupAccessPolicy`** : `OperatorAccessPolicy.read` et `AuthAccessPolicy.isSuperAdmin` suffisent.
- **Tests isolés du bucket** : `vitest.config.mts` force `S3_BUCKET: ''`, sinon les tests d'intégration auraient écrit dans le bucket configuré par le `.env`.
- **Retours de revue (2026-09-28)** : `Media.sourcePath` masqué dans l'admin et verrouillé par l'API (il n'était qu'en lecture seule dans l'admin, donc modifiable par REST) ; écriture des médias réservée aux admins ; typologie `category` et sélecteurs filtrés par type ; tests des règles d'écrasement des logos d'opérateurs. La migration, jamais déployée, a été régénérée sous le nom `20260928_150255_operator_groups_and_media` plutôt que complétée par une seconde.
- **Base de dev existante et `category` `NOT NULL`** : en mode `push`, une base qui contient déjà des médias fait proposer par Drizzle « Accept warnings and push schema to database? » avec un `TRUNCATE media CASCADE`, qui viderait presque toute la base (opérateurs, groupes, projets, dispositifs et leurs versions, utilisateurs, commentaires). **Répondre non** (le défaut, le serveur s'arrête), puis au choix : repartir d'une base vierge (`pnpm db:reset`, `pnpm db:up`, `pnpm dev` puis `pnpm seed`), ou garder les données en créant la colonne à la main avant `pnpm dev` :
  ```sh
  docker exec tee-poc-backoffice-postgres-1 psql -U tee -d tee -c "CREATE TYPE public.enum_media_category AS ENUM ('operator-logo', 'project-image'); ALTER TABLE media ADD COLUMN category public.enum_media_category; UPDATE media SET category = CASE WHEN source_path LIKE '/images/projet/%' THEN 'project-image'::public.enum_media_category ELSE 'operator-logo'::public.enum_media_category END; ALTER TABLE media ALTER COLUMN category SET NOT NULL;"
  ```
  `pnpm dev` démarre alors sans question (vérifié sur une base jetable), et un `pnpm seed` réaligne les types s'il le faut (compteur « recatégorisés »).
- **`apps/cms/.env.example`** : `TEE_OPERATORS_URL` et `TEE_ASSETS_BASE_URL` (commentées) restent à ajouter à la main par le mainteneur, l'outillage ne pouvant pas modifier les fichiers d'environnement.

---

## Questions ouvertes

- **Rafraîchissement des logos** : un logo remplacé en amont sous le même nom de fichier n'est pas réimporté (le média existe déjà pour ce `sourcePath`). L'amont publie les dates de téléchargement dans `libs/data/static/operator_images_download_info.json` et `project_images_download_info.json` : à exploiter si le besoin apparaît.
- **Export Grist / open data** des groupes et logos : à décider plus tard.
