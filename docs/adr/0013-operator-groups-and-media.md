# ADR 0013 : Groupes d'opérateurs, logos et médias importés depuis l'amont

**Date :** 2026-09-28
**Statut :** Accepté
**Décideurs :** Yohann
**Plan de mise en œuvre :** [Feature 006 : Groupes d'opérateurs, logos et images des projets](../features/006-operator-groups-and-logos.md)
**Complète :** [ADR 0012](0012-production-persistence-postgres.md) §7 (stockage objet des `Media`), [ADR 0003](0003-projects-collection.md) §5 (image des projets)

---

## Contexte

Le front TEE (dépôt `betagouv/mission-transition-ecologique`) affiche pour chaque dispositif le **logo de son opérateur de contact** et, pour chaque projet, une **image**. Le back-office ne portait aucune de ces données : les fichiers restaient dans le dépôt amont, `Projects.image` recopiait un chemin texte, et le stockage objet Scaleway (ADR 0012 §7) n'était alimenté par rien.

Côté amont, les opérateurs sont décrits par `apps/nuxt/src/public/json/operator/operators.json`, généré depuis la table Opérateurs de Baserow :

```json
{ "operator": "Opco Akto", "filterCategories": ["OPCO"], "imagePath": "/images/logos/operateur/opco-akto.webp", "color": "green" }
```

Constats (2026-09-28) :

- l'amont regroupe les 67 opérateurs en **12 groupes** (`filterCategories`) ; la relation est **plusieurs-à-plusieurs** (« CCI ou CMA » appartient à CCI et à CMA) ; 5 opérateurs n'ont aucun groupe ;
- côté front, le groupe ne sert qu'au filtre « Opérateur » de la liste des dispositifs ;
- le logo se résout sur le **nom exact** de l'opérateur de contact, sans héritage du groupe : 45 opérateurs sur 67 ont un logo, les autres retombent sur l'illustration du dispositif ;
- 91 projets, 91 images distinctes (`/images/projet/*.webp`) ;
- `Media.alt` est obligatoire et `Media` est lisible publiquement.

## Décision

### 1. Modèle : collection `operator-groups` et relation plusieurs-à-plusieurs

- Nouvelle collection **`operator-groups`** (`OperatorGroups.ts`) : `name` (unique), `slug` (unique), `logo` (upload vers `media`, optionnel). Lecture comme `Operators` (`OperatorAccessPolicy.read`), écriture réservée au super-admin, masquée de la navigation hors admins.
- Sur `Operators` : `groups` (relation `hasMany` vers `operator-groups`, dans l'ordre amont) et `logo` (upload vers `media`, optionnel). Colonnes de liste : nom, groupes, logo.
- Sur `Projects` : `image` passe de `text` à **`upload` vers `media`** (révision de l'ADR 0003 §5).
- Sur `Media` : `sourcePath` et `category` (voir §2), écriture réservée aux admins.

Options écartées :

- **`select hasMany`** sur `Operators` : vocabulaire des groupes figé dans le code, impossible d'y attacher un logo, alors que la liste vient de Baserow et peut évoluer.
- **Opérateur parent** (relation simple vers un opérateur « tête de réseau ») : ne représente pas « CCI ou CMA », rattaché à deux groupes.

### 2. Médias importés depuis l'amont

- **Source** : téléchargement HTTP depuis le dossier public du front amont (`raw.githubusercontent.com/betagouv/mission-transition-ecologique/main/apps/nuxt/src/public` + chemin amont), par `UpstreamAssetSource` (`libs/format-adapters`). Base surchargeable par `TEE_ASSETS_BASE_URL`, même timeout réseau (30 s) que les JSON, `fetch` injectable. Le type MIME vient de l'en-tête `content-type` s'il est `image/*`, sinon de l'extension : `raw.githubusercontent.com` sert certains fichiers (dont les SVG) en `text/plain`. Les chemins viennent d'un JSON amont : un chemin non enraciné, contenant `..`, `\` ou `%2e` est refusé avant tout téléchargement.
- **`operators.json`** est lu par `UpstreamJsonSource.operators()` comme les autres fichiers amont (URL surchargeable par `TEE_OPERATORS_URL`, copie versionnée dans `static/upstream/`, rafraîchie par `pnpm data:snapshot`), puis validé par `teeOperatorSchema` (zod) : une forme inattendue fait échouer le seed au lieu de l'alimenter.
- **Identité d'un média importé** : champ `sourcePath` sur `Media` (chemin amont, unique, indexé, vide pour un upload manuel). C'est la clé d'idempotence de l'import : il est **masqué dans l'admin** (ni colonne de liste, ni sidebar) et **verrouillé par l'API** comme `Programs.canonicalId` (accès de champ `create`/`update` refusé à tous) : une valeur envoyée par l'admin, REST ou GraphQL, même par un admin, est ignorée sans erreur. Seules les écritures de la Local API avec `overrideAccess` (le seed) le renseignent. `UpstreamMediaImporter.findOrCreate(sourcePath, alt, category)` cherche d'abord un média portant ce chemin, et ne télécharge que s'il n'en trouve pas. Relancer le seed ne crée ni doublon ni nouvel objet dans le bucket, même si Payload a renommé le fichier à cause d'un conflit de nom.
- **Texte alternatif** : `Logo de <nom>` pour un opérateur ou un groupe, titre du projet pour une image de projet.
- **Typologie** : champ `category` (libellé « Type », `select` obligatoire, options dans `apps/cms/src/constants/mediaCategoryOptions.ts`) : `operator-logo` (« Logo d'opérateur ») ou `project-image` (« Image de projet »), affiché dans le formulaire principal et en colonne de liste. Le seed pose `operator-logo` sur les logos d'opérateurs et de groupes (les logos par défaut des groupes partagent leurs fichiers avec des logos d'opérateurs, par exemple `ademe.webp` : même type, pas de conflit) et `project-image` sur les images de projets. Un média déjà importé dont le type diffère est **réaligné** au seed suivant (compteur « recatégorisés » du récapitulatif).
- **Sélecteurs filtrés** : `Operators.logo` et `OperatorGroups.logo` n'acceptent que des `operator-logo`, `Projects.image` que des `project-image` (`filterOptions` des champs `upload`). Payload applique ce filtre dans le sélecteur de l'admin **et à la validation de chaque écriture**, Local API comprise : un média du mauvais type est refusé (`ValidationError` sur le champ).
- **Accès** : lecture publique ; création, modification et suppression réservées aux admins et super-admins (`AuthAccessPolicy.isAdmin`). Un créateur ne peut ni uploader ni modifier un média.
- **Anomalies** : un fichier introuvable (404), un refus HTTP ou un chemin invalide est **signalé en fin de seed** (compteur par message), sans faire échouer le seed ; le document est gardé sans image. Un chemin en échec n'est pas retenté pendant la même exécution.
- **Écritures séquentielles**, sous `SystemWorkflowContext` comme le reste du seed : deux appels concurrents pourraient créer deux médias pour le même chemin.
- **Repli local** (`TEE_UPSTREAM_LOCAL_FALLBACK=1`) : les images **ne sont pas versionnées** dans `static/upstream/`. En repli, le rattachement aux groupes se fait depuis la copie d'`operators.json`, les téléchargements échouent et sont signalés, le seed se termine.

### 3. Logo effectif : secours par le groupe

- `OperatorLogoResolver` (`apps/cms/src/services/operators/`) est le **seul point de résolution** : logo de l'opérateur (origine `operateur`), sinon logo du premier de ses groupes, dans l'ordre amont, qui en a un (origine `groupe`), sinon aucun. Il attend un opérateur lu avec `depth >= 2` : un groupe resté à l'état d'id ne peut pas être inspecté et est ignoré.
- **Écart assumé avec le front amont**, qui retombe sur l'illustration du dispositif : le secours par groupe donne un logo aux 3 agences de l'eau, 3 CCI et 4 CMA régionales qui n'en ont pas.
- L'amont n'a pas de logo de groupe. La table explicite **`OperatorGroupLogoDefaults`** associe un groupe au logo de son opérateur « générique » : Agence de l'eau → `agence-de-l-eau.webp`, CCI → `cci.webp`, CMA → `cma.webp`, ADEME → `ademe.webp`, Bpifrance → `bpi.webp`. Les autres groupes restent sans logo, modifiables dans l'admin.

### 4. Règles d'écrasement au seed (décidées à l'implémentation)

- **Groupes** : upsert par slug du nom **ou par nom** (`OperatorGroupImporter`) : un groupe créé dans l'admin avec un slug à lui est retrouvé par son nom et garde son slug, au lieu d'être recréé (ce qui échouerait sur l'unicité du nom et arrêterait le seed). Le logo par défaut n'est posé que si le groupe n'a **aucun logo** : un logo de groupe posé dans l'admin n'est jamais écrasé.
- **Rattachement opérateur → groupes** (`OperatorProfileImporter`, rapprochement par slug du nom, le même que `OperatorImporter`) : la liste `groups` d'un opérateur est **remplacée par la liste amont à chaque seed**. Une modification manuelle des groupes d'un opérateur est donc perdue au seed suivant, conformément à l'amont maître (ADR 0012).
- **Logo d'un opérateur et image d'un projet**, même règle portée par `ImportedMediaPolicy` (`seed/media/`) :
  - un logo **uploadé à la main** (média sans `sourcePath`) n'est **jamais écrasé** ;
  - un logo **importé** (média avec `sourcePath`) suit l'amont : remplacé si l'amont change de chemin, **retiré** si l'amont n'a plus d'`imagePath` ;
  - un **téléchargement en échec garde le logo actuel** au lieu de le vider.
- **Opérateur amont absent du CMS** : signalé, pas créé. Le CMS ne crée que les opérateurs cités par au moins un dispositif (`OperatorImporter`).
- **Image d'un projet** : `ProjectImporter` calcule l'image (`ImportedMediaPolicy`, projet existant lu en `depth: 1`) avant d'appeler `ProjectMapper.map(project)`, qui reste synchrone.
- **Cellules vides de Baserow** : un `imagePath` ou des `filterCategories` vides (`''`) ou `null` dans `operators.json` valent « absent » (`teeOperatorSchema`), au lieu de faire échouer la validation et tout le seed.

### 5. Stockage objet : plugin toujours enregistré, fichiers publics

- **Découverte à l'implémentation** : le plugin `@payloadcms/storage-s3` ajoute ses propres colonnes à `media` (`prefix`, `_objectKey`), **seulement quand il est enregistré**. Il ne l'était qu'en présence d'un bucket : une migration générée en local (sans bucket) n'avait donc pas les colonnes que la préprod et la prod attendaient. Le plugin est désormais **toujours enregistré**, avec `enabled: Boolean(objectStorage)` et `alwaysInsertFields: true` : le schéma est identique dans tous les environnements, et sans bucket Payload garde son stockage disque. La migration `20260928_150255_operator_groups_and_media` ajoute `media.prefix` et `media._objectkey` pour cette raison.
- **ACL `public-read` par objet** (`acl: 'public-read'`) et **`disablePayloadAccessControl: true`** sur `media`, dès cette feature : les fichiers importés par le seed sont publics d'emblée et leur URL pointe directement sur le bucket, sans ré-upload ultérieur. Motivation et vérifications : voir §6.
- `vitest.config.mts` force `S3_BUCKET: ''` : les tests d'intégration n'écrivent jamais dans un bucket réel, même si le `.env` en configure un.

### 6. Exposition AGIR (conçue, non implémentée)

L'exposition des groupes et du logo effectif dans l'API AGIR fera l'objet d'une feature ultérieure. Conception retenue :

- **canonical** : `operateurSchema` gagne `groupes` (noms des groupes) et `logo` (URL du logo effectif, avec son origine `operateur` ou `groupe`), optionnels ;
- **`ProgramCanonicalMapper`** les remplit via `OperatorLogoResolver` ; **`TeeImporter`** les laisse vides (l'import sans Payload n'a pas les médias) ;
- **`AgirDetailExporter`** et **`AdemePivotExporter`** les projettent ; vocabulaire et forme exacte à valider avec l'équipe AGIR ;
- **URL servie par le bucket** (décidé le 2026-09-28), le bucket étant **lisible publiquement en lecture seule** : lecture d'un objet ouverte à tous, pas de listing, écriture réservée à la clé du back-office. L'URL du bucket ne dépend pas du back-office, ce qui va dans le sens de l'ADR 0008 (anti-lock-in) ;
- **méthode retenue : ACL `public-read` par objet**, posée à l'upload par le plugin, bucket laissé privé, sans bucket policy. Une bucket policy a été écartée : elle retire l'accès à tout principal qu'elle ne cite pas, IAM compris, et une erreur couperait l'écriture du back-office. Côté Payload, `disablePayloadAccessControl: true` fait pointer l'URL générée sur le bucket. Pas de perte de contrôle d'accès : `Media` est déjà lisible par tous. Conséquence : **tout fichier de `Media` est public** ; un futur média confidentiel demanderait une collection d'upload séparée ;
- **vérifié le 2026-09-28 sur `tee-backoffice-media-pre-prod`** (script de contrôle, objet de test supprimé ensuite) : lecture anonyme 200, listing anonyme 403, `PUT` et `DELETE` anonymes 403, écriture et suppression par la clé du back-office OK ;
- **limite** : une ancienne version d'un objet reste lisible anonymement avec son `versionId` (200), l'ACL étant portée par chaque version. Risque faible : un `versionId` n'est pas devinable et ne s'obtient qu'en listant les versions, ce qui est refusé aux anonymes. À réduire par la règle de cycle de vie qui expire les versions non courantes ;
- les fichiers uploadés **avant** l'activation de l'ACL restent privés : à ré-uploader, ou à passer en public depuis la console Scaleway ;
- **contrôles à refaire sur le bucket de prod** : `GET` anonyme d'un objet → 200 ; `GET` anonyme de la racine du bucket (listing) → 403 ; `PUT` et `DELETE` anonymes → 403 ; écriture et suppression par la clé du back-office → OK ;
- **repli** si la lecture seule publique est abandonnée : URL servie par le back-office (`/api/media/file/<fichier>`), bucket privé, base de l'URL absolue construite par les endpoints AGIR comme leurs autres liens (`PUBLIC_BASE_URL`, sinon `req.origin`). C'est aussi le cas sans stockage objet (dev local : URL relative, préfixée par les endpoints) ;
- le groupe porté par le canonical pourra remplacer l'heuristique `CCI_CMA_MARKER` de l'export Grist.

### 7. Export Grist / open data

Non décidé : les groupes et logos ne sont pas exportés vers Grist pour l'instant.

## Conséquences

**Positif**
- Le back-office porte les groupes d'opérateurs (donnée métier jusqu'ici absente) et les fichiers affichés par le front, sans dépendre du dépôt amont pour les servir.
- Le stockage objet est alimenté par le seed : 136 médias (45 logos d'opérateurs, 91 images de projets) sur un seed complet, aucun nouveau média au second passage.
- Un seul point de résolution du logo effectif, réutilisable par l'exposition AGIR.
- Schéma `media` identique en dev, CI, préprod et prod, quelle que soit la configuration du bucket.

**Coûts / limites**
- La migration supprime la colonne texte `projects.image` : les chemins sont perdus en préprod et en prod, et le seed suivant les remplace par des médias. En dev, `pnpm db:reset` puis `pnpm seed`.
- `media.category` est `NOT NULL` : la migration pose `project-image` sur les médias antérieurs avant la contrainte (retouche manuelle de la migration générée, un `ADD COLUMN ... NOT NULL` échouant sur une table peuplée). En dev (mode `push`), une base qui a déjà des médias sans `category` fait proposer par Drizzle un `TRUNCATE media CASCADE`, qui viderait presque toute la base (opérateurs, dispositifs, projets, utilisateurs) : refuser, et créer la colonne à la main ou repartir d'une base vierge (voir la feature 006).
- Une modification manuelle des groupes d'un opérateur est écrasée au seed suivant.
- **Rafraîchissement** : un logo remplacé en amont sous le même nom de fichier n'est pas réimporté (le média existe déjà pour ce `sourcePath`). L'amont publie des dates de téléchargement (`libs/data/static/operator_images_download_info.json`, `project_images_download_info.json`) exploitables si le besoin apparaît.
- Les opérateurs cités par des dispositifs mais absents d'`operators.json` (9 CMA régionales au 2026-09-28) n'ont ni groupe ni logo de secours : voir les écarts de la feature 006.
- Tout fichier de `Media` est public (voir §6).

## Alternatives écartées

- **`select hasMany`** ou **opérateur parent** pour les groupes : voir §1.
- **Versionner les images dans `static/upstream/`** pour le repli local : volume inutile dans le dépôt pour un usage de secours en développement.
- **Identifier un média importé par son nom de fichier** : Payload renomme un fichier en cas de conflit, ce qui casserait l'idempotence ; d'où `sourcePath`.
- **Bucket policy** pour rendre le bucket lisible : voir §6.
- **Fichiers servis par Payload** (configuration initiale de l'ADR 0012 §7) : gardé comme repli (§6), mais l'URL dépendrait du back-office.
