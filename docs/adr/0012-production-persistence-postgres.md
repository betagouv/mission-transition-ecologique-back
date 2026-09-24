# ADR 0012 : Persistance de production sur PostgreSQL (Scalingo)

**Date :** 2026-09-22
**Statut :** Proposé
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

### 3. Payload : adaptateur Postgres et migrations versionnées

- `@payloadcms/db-sqlite` est remplacé par **`@payloadcms/db-postgres`**, la chaîne de connexion venant de `Config.databaseUrl()` (`DATABASE_URI`, sinon `SCALINGO_POSTGRESQL_URL`).
- Le mode `push` (synchronisation automatique du schéma) reste actif **en dev uniquement** (comportement par défaut de Payload, désactivé quand `NODE_ENV=production`).
- En prod, le schéma évolue par **migrations versionnées** (`apps/cms/src/migrations/`, générées par `payload migrate:create`) et appliquées **au démarrage du serveur** via l'option `prodMigrations`. On n'a donc pas besoin d'étape `postdeploy` : un conteneur qui démarre applique d'abord les migrations en attente.
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
- **Préprod** : addon Scalingo (plus petite offre), configuré comme la prod. C'est là que les migrations et la bascule sont répétées avant la prod.
- **Prod** : addon Scalingo.

Les fichiers `apps/cms/tee-poc.db` et `libs/canonical-store/canonical.db` **sortent du dépôt** une fois la bascule faite.

### 6. Données initiales de prod : migration ponctuelle, sans utilisateurs de dev

La première mise en service se fait par un script ponctuel lancé dans un conteneur one-off Scalingo (`scalingo run`) : migrations Payload, puis seed des référentiels (zones géographiques, opérateurs, dispositifs, projets). Le store canonical se remplit via le hook `syncCanonicalOnPublish`, comme aujourd'hui.

`UsersSeed` crée des comptes dont le mot de passe est égal à l'email : il **ne doit jamais tourner en prod**. Le seed devient conditionnel (`UsersSeed` exclu quand `NODE_ENV=production`, ou étape explicitement opt-in) et le premier super-admin de prod est créé à la main.

Si des éditions faites en prod doivent être conservées avant la bascule, on ne les récupère pas depuis le conteneur (éphémère) : les ressaisir ou les exporter via l'API avant de basculer.

### 7. Uploads `Media` : stockage objet S3

Même problème, solution distincte : plugin **`@payloadcms/storage-s3`** vers un bucket S3 hébergé en France (Outscale, Scaleway ou OVH, à arbitrer selon le marché ADEME et beta.gouv). Scalingo ne fournit pas de stockage objet. Ce point peut être livré séparément de la bascule Postgres.

## Question ouverte : qui écrit dans le canonical de prod ?

Aujourd'hui, deux chemins alimentent le store canonical, et c'est le fichier commité qui départage :

1. le **hook `syncCanonicalOnPublish`** (publication dans le CMS) ;
2. le **pipeline quotidien `daily_data.yml`**, qui fait `rm -f canonical.db`, reconstruit tout depuis `programs.json` amont (`import:tee`), pousse vers Grist et **commite** la base.

Avec une base persistante partagée, le chemin 2 tel quel **écraserait** chaque nuit ce que le CMS a publié, et l'étape de commit n'a plus de sens. Il faut choisir la source de vérité de la période de transition :

| Option | Principe | Conséquence |
|---|---|---|
| **A. Amont maître** (transition) | Le pipeline reste la source ; il écrit directement dans le Postgres de prod (tâche planifiée Scalingo `cron.json`, pas de commit), dans une transaction « tout remplacer ». Le hook CMS est désactivé en prod. | Le back-office sert de préproduction éditoriale ; rien de ce qui est publié dans le CMS n'atteint AGIR. |
| **B. CMS maître** | Le hook est la seule écriture ; le pipeline cesse d'écrire dans le store et ne fait plus que l'export Grist depuis le canonical. | Suppose que les dispositifs amont aient été importés dans Payload et que l'équipe édite désormais dans le back-office. |
| **C. Fusion** | Le pipeline fait un upsert sans suppression ; le plus récent (`date_mise_a_jour`) gagne. | Complexe, suppressions amont non propagées, conflits silencieux. À éviter. |

**Recommandation : A tant que le site TEE lit `programs.json` amont, puis B à la bascule éditoriale.** La décision relève du produit ; elle doit être prise avant la mise en service (étape 6 du plan) parce qu'elle conditionne la réécriture de `daily_data.yml`.

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
- **Deux instances Postgres** (une par base) : isolation maximale mais double coût et double exploitation, sans bénéfice à ce stade ; les deux variables d'environnement distinctes permettent d'y venir plus tard.
