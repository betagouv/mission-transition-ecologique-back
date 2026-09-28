# ADR 0012 : Persistance de production sur PostgreSQL (Scalingo)

**Date :** 2026-09-22
**Statut :** Accepté
**Décideurs :** Yohann
**Plan de mise en œuvre :** [Feature 004 : Migration PostgreSQL](../features/004-postgres-migration.md)

---

## Contexte

L'application est déployée sur **Scalingo** (`Procfile` : `web: pnpm start`). Elle s'appuie aujourd'hui sur deux bases **SQLite fichier** :

| Base | Fichier | Accès | Rôle |
|---|---|---|---|
| Payload | `apps/cms/tee-poc.db` (commitée) | `@payloadcms/db-sqlite`, `DATABASE_URI` | Données éditoriales du CMS (dispositifs, projets, utilisateurs, versions, commentaires) |
| Canonical | `libs/canonical-store/canonical.db` (commitée) | libSQL + Drizzle, `CANONICAL_DATABASE_URI` | Format pivot, source de vérité durable (ADR 0008), lu par les endpoints AGIR |

Le système de fichiers d'un conteneur Scalingo est **éphémère** : il repart de l'image de build à chaque déploiement, redémarrage ou changement d'échelle. Scalingo ne propose **pas de volume persistant**. En conséquence :

- toute écriture faite en prod (édition d'un dispositif, publication, commentaire de relecture, création d'utilisateur) est **perdue au déploiement suivant** ;
- la prod sert en réalité les fichiers `.db` commités, ce qui fait du dépôt git un canal de données ;
- les uploads de la collection `Media` (`apps/cms/media/`) sont perdus de la même façon.

Ce fonctionnement convenait au POC en lecture seule. Il n'est plus tenable dès que des utilisateurs éditent dans le back-office de prod.

L'ADR 0008 prévoyait déjà une migration Postgres : colonne `data` en `TEXT` JSON, changement limité à `schema.ts` et `db.ts` du store.

## Décision

### 1. Une instance PostgreSQL managée Scalingo (addon)

La persistance de production repose sur **l'addon PostgreSQL de Scalingo**, provisionné sur l'application, dans la même région qu'elle. Sauvegardes, mises à jour et supervision sont assurées par l'hébergeur.

### 2. Deux schémas Postgres dans la même instance

Une seule instance, deux **schémas** Postgres pour garder la séparation de l'ADR 0008 (le canonical survit à un changement de CMS) :

| Schéma | Propriétaire | Contenu |
|---|---|---|
| `public` | Payload | Tables générées par `@payloadcms/db-postgres` |
| `canonical` | `libs/canonical-store` | Table `canonical.canonical_programs` |

Payload reste dans `public` : son option `schemaName` est **expérimentale** et n'apporte rien ici. Le store déclare son schéma avec `pgSchema('canonical')` de Drizzle. L'isolation se fait donc par le schéma, dans le code, les deux accès partageant la même URL.

**Résolution de l'URL** : Scalingo injecte lui-même le DSN de l'addon dans `SCALINGO_POSTGRESQL_URL` sur l'app (prod et préprod), sans intervention. La classe `apps/cms/src/config/Config.ts` (point d'entrée unique des variables d'environnement du CMS) lit donc `DATABASE_URI` en priorité (local, CI, ou surcharge ponctuelle) puis retombe sur `SCALINGO_POSTGRESQL_URL` ; si aucune des deux n'est définie, il lève une erreur explicite au démarrage. Rien n'est à configurer sur le serveur, et les deux variables applicatives (`DATABASE_URI` pour Payload, `CANONICAL_DATABASE_URI` pour le store) restent distinctes pour pouvoir séparer les bases plus tard sans toucher au code.

Pour un changement de CMS, on supprime le schéma `public` et on garde `canonical`.

**Écart assumé vis-à-vis de l'ADR 0008**, qui prévoyait une base *dédiée* pour le canonical. Décision reconfirmée le 2026-09-24 : on reste sur deux schémas dans une même base.

- *Ce qui est préservé* : l'anti-lock-in (le canonical survit à la suppression de `public`) et l'indépendance du code (les deux variables restent distinctes, le store crée son schéma tout seul).
- *Ce qui est perdu* : les **sauvegardes et restaurations sont communes**. Restaurer Payload à une date antérieure ramène le canonical avec lui, sans restauration indépendante possible. S'y ajoutent l'absence d'isolation des ressources (une requête lourde du CMS pénalise les endpoints publics) et des droits d'accès séparés plus difficiles à poser.
- *Pourquoi maintenant* : une base = un addon Scalingo, donc deux bases = double coût et double exploitation pour un POC. Un addon managé n'autorise par ailleurs généralement pas la création d'une seconde base dans la même instance (à vérifier au provisionnement).
- *Porte de sortie* : passer à une base dédiée est un **changement de configuration, pas de code** : provisionner un second addon et pointer `CANONICAL_DATABASE_URI` dessus (en local, une base `tee_canonical` de plus dans le conteneur). À faire le jour où le canonical porte une obligation de service (consommation réelle par AGIR et Grist), où la restauration indépendante devient un besoin.

### 3. Payload : adaptateur Postgres et migrations versionnées

- `@payloadcms/db-sqlite` est remplacé par **`@payloadcms/db-postgres`**, la chaîne de connexion venant de `Config.databaseUrl()` (`DATABASE_URI`, sinon `SCALINGO_POSTGRESQL_URL`).
- Le mode `push` (synchronisation automatique du schéma) reste actif **en dev uniquement** (comportement par défaut de Payload, désactivé quand `NODE_ENV=production`).
- En prod, le schéma évolue par **migrations versionnées** (`apps/cms/src/migrations/`, générées par `payload migrate:create`) et appliquées **au démarrage du serveur** via l'option `prodMigrations`. On n'a donc pas besoin d'étape `postdeploy` pour les migrations : un conteneur qui démarre applique d'abord les migrations en attente. (Le `postdeploy` ajouté le 2026-09-28 ne sert qu'à réinitialiser la base de la préprod, voir §5 ; il ne fait rien en prod.)
- Nouvelle règle de travail : **tout changement de champ ou de collection s'accompagne d'une migration** commitée. Cela remplace le « reset + reseed » actuel (voir mémo sur les changements de type de champ).

### 4. Store canonical : un seul dialecte, Postgres

- `schema.ts` passe de `sqlite-core` à `pg-core` (`pgSchema('canonical').table(...)`). Colonne `data` conservée en **`text`** : le repository (`JSON.stringify` / `JSON.parse`) ne change pas. Le passage en `jsonb` (requêtes sur le contenu) est hors périmètre.
- `db.ts` passe de `@libsql/client` à `node-postgres` (`drizzle-orm/node-postgres`). L'amorçage idempotent reste en place (`CREATE SCHEMA IF NOT EXISTS canonical` + `CREATE TABLE IF NOT EXISTS`) : une table unique ne justifie pas encore `drizzle-kit`.
- `createCanonicalProgramRepository()` garde son contrat (le CMS ne connaît toujours pas la localisation de la base). La résolution par défaut vers `libs/canonical-store/canonical.db` disparaît : le store lit `CANONICAL_DATABASE_URI`, sinon `SCALINGO_POSTGRESQL_URL`, et lève une erreur explicite si aucune n'est définie.
- **Tests du store** : [PGlite](https://pglite.dev/) (Postgres compilé en WASM, en mémoire, supporté par `drizzle-orm/pglite`) remplace libSQL `:memory:`. On garde des tests rapides, sans Docker, sur le vrai dialecte. `DrizzleCanonicalProgramRepository` reçoit donc une instance Drizzle Postgres (node-postgres en prod, PGlite en test) plutôt qu'une URL.

Je n'ai pas retenu un store multi-dialecte (libSQL ou Postgres selon le préfixe de l'URL) : il faudrait deux `schema.ts`, deux jeux de tests et une dérive quasi certaine.

### 5. Postgres partout : dev, CI, préprod, prod

Un seul moteur, dans tous les environnements :

- **Dev** : conteneur Docker dédié, décrit par `docker-compose.yml` à la racine. Le service `postgres` (version majeure alignée sur l'addon Scalingo) crée au premier démarrage la base de dev `tee` (`POSTGRES_DB`) et, via un script d'init (`docker/postgres/init/`), la base de test `tee_test` utilisée par les tests d'intégration. Les données vivent dans un volume Docker nommé : elles survivent à l'arrêt du conteneur et se remettent à zéro par `docker compose down -v`. `.env.example` pointe vers `postgres://tee:tee@localhost:5432/tee`.
- **CI** : service `postgres` GitHub Actions sur les jobs `test` et `e2e`. L'E2E ne dépend plus de `apps/cms/tee-poc.db` commitée : le job enchaîne `migrate` puis `seed` avant Playwright.
- **Préprod** : addon Scalingo (plus petite offre), configuré comme la prod. C'est là que les migrations et la bascule sont répétées avant la prod. **Seule différence avec la prod** (décidé le 2026-09-28) : la base est **réinitialisée à chaque déploiement**. L'étape `postdeploy` du `Procfile` (`pnpm scalingo:postdeploy`, `apps/cms/src/scripts/postdeploy/run.ts`) supprime les schémas `public` et `canonical` (`DatabaseSchemaReset`, aussi utilisée par les tests d'intégration), puis lance le seed ; en `NODE_ENV=production`, l'initialisation de Payload applique d'abord toutes les migrations sur le schéma vide. Le `Procfile` étant commun aux deux apps, la réinitialisation n'a lieu que si `TEE_RESET_DATABASE_ON_DEPLOY` vaut `1` (ou `true`) sur l'app (`DeployDatabaseResetSettings`). Le flag ne peut pas porter le nom de l'app, comme envisagé d'abord : les review apps de préprod changent de nom à chaque pull request (`tee-back-preprod-pr61`…). Contrepartie : la variable ne doit **jamais** être recopiée sur la prod, où elle viderait la base à chaque déploiement. Sur la prod, sans la variable, l'étape ne fait rien. Les fichiers du bucket de préprod ne sont pas purgés : ceux qu'un seed recrée sous le même nom écrasent l'objet existant, les uploads manuels restent orphelins. **Review apps** (une par PR, créées depuis l'app de préprod dont elles copient les variables) : le manifeste `scalingo.json` à la racine redéfinit `PUBLIC_BASE_URL` avec le générateur `url` (l'URL de la review app, et non celle de la préprod). Les variables héritées ne sont pas toutes adaptées : un `DATABASE_URI` de la préprod (reste de l'époque SQLite, `file:./tee-poc.db`) prime sur `SCALINGO_POSTGRESQL_URL` et fait échouer le postdeploy (`ECONNREFUSED 127.0.0.1:5432`) ; le supprimer de l'app de préprod une fois PostgreSQL déployé sur `main`, et d'ici là de chaque review app (`scalingo env-unset DATABASE_URI`).
- **Prod** : addon Scalingo.

Les fichiers `apps/cms/tee-poc.db` et `libs/canonical-store/canonical.db` **sortent du dépôt** une fois la bascule faite.

### 6. Données initiales de prod : migration ponctuelle, utilisateurs de test sur demande

La première mise en service se fait par un script ponctuel lancé dans un conteneur one-off Scalingo (`scalingo run pnpm seed:scalingo`, qui appelle le seed par `tsx` : `nx` est une devDependency absente du conteneur) : migrations Payload, puis seed des référentiels (zones géographiques, opérateurs, dispositifs, projets). Le store canonical se remplit via le hook `syncCanonicalOnPublish`, comme aujourd'hui.

`UsersSeed` crée des comptes dont le mot de passe est égal à l'email. En `NODE_ENV=production`, il ne tourne que sur demande explicite, `TEE_SEED_DEV_USERS=1` (`Config.seedsDevUsers()`). Révisé le 2026-09-28 : la préprod garde cette variable en permanence (sa base étant recréée à chaque déploiement, il faut un accès admin à chaque fois), et la prod la reçoit **pour son premier seed seulement** (`scalingo run --env TEE_SEED_DEV_USERS=1 pnpm seed:scalingo`). ⚠️ Ces comptes sont exposés sur une URL publique avec un mot de passe trivial : en prod, changer leur mot de passe ou les supprimer juste après la mise en service.

Si des éditions faites en prod doivent être conservées avant la bascule, on ne les récupère pas depuis le conteneur (éphémère) : les ressaisir ou les exporter via l'API avant de basculer.

### 7. Uploads `Media` : stockage objet Scaleway

Même problème, solution distincte : Scalingo ne fournit **aucun stockage objet** (ni addon, ni service intégré), donc les fichiers de la collection `Media` disparaissent à chaque déploiement comme le faisait la base.

Décision (2026-09-25) : **Scaleway Object Storage** (API S3, région `fr-par` par défaut), via le plugin **`@payloadcms/storage-s3`**, enregistré dans `plugins` (cette version de Payload n'a pas encore de clé `storage` de premier niveau).

- Activation par la seule présence de `S3_BUCKET`, `S3_ACCESS_KEY_ID` et `S3_SECRET_ACCESS_KEY` (`Config.objectStorage()`). `S3_REGION` et `S3_ENDPOINT` ont des valeurs par défaut Scaleway Paris.
- **Sans bucket configuré, rien ne change** : Payload garde son stockage disque, ce qui convient au développement, à la CI et aux tests.
- Les fichiers restent servis **par Payload** (contrôle d'accès natif conservé) : le bucket n'a pas besoin d'être public. Passer en accès direct (`disablePayloadAccessControl`) est possible plus tard si la bande passante le justifie.

## Qui écrit dans le canonical de production (tranché le 2026-09-24)

Deux chemins alimentent le store : le **hook `syncCanonicalOnPublish`** (publication dans le CMS) et le **pipeline quotidien** (alignement sur le `programs.json` amont : upserts + retrait des dispositifs disparus, sans jamais vider le store, lui-même issu d'une transformation de données Baserow).

**Décision : l'amont reste maître (option A).** La production n'est pas éditée par des utilisateurs ; elle est mise à jour par une tâche planifiée quotidienne. Le hook **reste actif** (pas d'interrupteur à poser) : il écrit simplement dans un store que le prochain import écrasera. C'est assumé, et ça garde le chemin de synchronisation vivant et testé.

Conséquences à connaître :

- **Une publication faite dans le back-office de prod ne survit pas à l'import suivant.** Le pipeline réécrit chaque dispositif depuis l'amont et retire ceux qui en ont disparu. Il refuse un snapshot vide ou trop destructeur (garde-fou `CanonicalSnapshotGuard`, voir `docs/context/schema-grist-export.md`).
- **Un même identifiant canonique pour les deux écrivains** (corrigé le 2026-09-25) : l'import dérive l'id du slug (`SlugCanonicalId`), et le seed fournit ce même id au CMS ; `assignCanonicalId` l'accepte pour une écriture système (`SystemWorkflowContext`) au lieu de garder l'ancien cuid2 aléatoire. Le hook `syncCanonicalOnPublish` retire alors la ligne stockée sous l'ancien id, sinon elle garderait le slug et ferait échouer l'écriture (contrainte `slug UNIQUE`). Avant ce correctif, 234 dispositifs sur 276 échouaient en `sync_failed` après un import. Un dispositif créé à la main dans le back-office garde un cuid2 aléatoire (slug nouveau, donc sans conflit). Limite : un dispositif en création est réécrit en brouillon, seule sa dernière version porte l'id réaligné, la ligne principale garde l'ancien. Sans effet : le hook ne synchronise pas les états en cours, et à la publication Payload fournit la dernière version au hook, si bien que la ligne principale prend l'id réaligné et le store reste sur une seule ligne, que le formulaire renvoie ou non `canonicalId` (test `canonical-publish-realigned.int.spec.ts`).

**Bascule prévue vers le CMS maître (option B)** le jour où l'amont cesse d'être mis à jour (arrêt de la transformation Baserow vers `programs.json`) : il suffira alors de désactiver la tâche planifiée, le hook étant déjà en place.

### Où tourne le pipeline

**Tâche planifiée Scalingo** (`cron.json` à la racine, script `pnpm data:daily`), et non plus GitHub Actions :

- elle s'exécute dans un conteneur one-off de l'app, avec ses variables d'environnement, donc avec l'accès à la base ; l'addon n'a pas besoin d'être exposé sur Internet ;
- les logs partent dans les logs de l'application (`scalingo logs`), les tâches se listent avec `scalingo cron-tasks` ;
- limites de la plateforme : 5 tâches par application, 10 minutes d'intervalle minimum, 12 heures d'exécution maximum, horaires en UTC, exécution non garantie (rares ratés) et décalage possible.

Le pipeline lit désormais les deux fichiers amont **par HTTP** (`UpstreamJsonSource`, URLs surchargeables par `TEE_PROGRAMS_URL` / `TEE_REDIRECTS_URL`) au lieu de les écrire sur un disque éphémère, et **ne commite plus rien** : `daily_data.yml` est supprimé.

**Surveillance** : Scalingo ne notifie pas nativement l'échec d'une tâche planifiée. Le script sort en code non nul en cas d'erreur, ce qui rend l'échec visible dans les logs. Un canal d'alerte (email ou Slack) pourra être branché sur le port d'observabilité `CanonicalEventSink` (ADR 0008 §6) si le besoin se confirme.

## Conséquences

**Positif**
- Les données de prod survivent aux déploiements, redémarrages et changements d'échelle. Plusieurs conteneurs peuvent écrire en même temps (déploiement blue/green Scalingo, montée en charge).
- Sauvegardes et restauration gérées par l'hébergeur ; hébergement en France.
- Le dépôt git cesse d'être un canal de données (plus de `.db` commitées ni de commits de données par la CI).
- Même moteur en dev, en CI et en prod : les écarts de comportement SQLite/Postgres (typage, contraintes, tri, sensibilité à la casse) disparaissent.
- La séparation Payload / canonical de l'ADR 0008 est conservée (schémas distincts).

**Coûts / limites**
- Coût mensuel de l'addon (et du bucket S3).
- Discipline de migrations Payload : chaque évolution de schéma produit une migration relue et commitée. Fini le reset de base comme réponse par défaut.
- Dev local : Docker requis (`docker compose up -d`).
- CI plus lente : service Postgres, migrate et seed avant l'E2E.
- Nombre de connexions limité sur les petites offres de l'addon : pools `pg` bornés côté Payload et côté store (voir plan).
- Le bug Payload `select hasMany` imbriqué (ADR 0011, mémo associé) a été observé sous SQLite ; son comportement sous Postgres est à revérifier. Le contournement `json` actuel reste valable dans les deux cas.

## Alternatives écartées

- **libSQL distant (Turso)** : le moins de code (les deux accès utilisent déjà `@libsql/client`, seules les URL changeraient), mais hébergement par une société américaine, hors de France : bloquant pour un service public ADEME (souveraineté, RGPD, homologation). Héberger `sqld` soi-même est impossible sur Scalingo faute de disque persistant.
- **SQLite + Litestream vers S3** (restauration au démarrage, réplication continue) : Scalingo fait tourner l'ancien et le nouveau conteneur en parallèle pendant un déploiement, donc deux écrivains et des bases qui divergent ; perte des dernières écritures à l'arrêt ; pas de montée en charge horizontale.
- **Changer d'hébergeur pour un disque persistant** (VPS, instance avec volume) : garde SQLite, mais l'exploitation (sauvegardes, mises à jour, supervision) passe à ma charge. Disproportionné pour ce projet.
- **MongoDB (addon Scalingo)** : supporté par Payload mais pas par Drizzle pour le store canonical ; on aurait deux moteurs.
- **SQLite en local et en préprod, Postgres en prod seulement** : possible (adaptateur Payload choisi selon l'URL, deux implémentations du port `CanonicalProgramRepository`), mais la prod deviendrait le premier environnement où tournent les migrations Postgres et où se révèlent les écarts de comportement SQLite/Postgres (casse des recherches, tri, typage, contraintes, concurrence). La préprod ne jouerait plus son rôle de répétition, et le code du store serait en double. Écarté au profit de Postgres partout.
- **Deux instances Postgres** (une par base, comme prévu par l'ADR 0008) : isolation maximale, sauvegardes et restaurations indépendantes, mais double coût et double exploitation pour un POC. Écartée pour l'instant, avec une porte de sortie sans changement de code (voir §2).
