# Feature 004 : Migration PostgreSQL (persistance de production)

**ADR :** [0012-production-persistence-postgres](../adr/0012-production-persistence-postgres.md)
**Complète :** [ADR 0008](../adr/0008-canonical-persistence-ddd.md) (gap « Migration Postgres à venir »)

---

## Contexte

Sur Scalingo, le système de fichiers d'un conteneur est éphémère : les deux bases SQLite (`apps/cms/tee-poc.db` pour Payload, `libs/canonical-store/canonical.db` pour le canonical) et les uploads `Media` sont réinitialisés à chaque déploiement. La prod sert les fichiers `.db` commités et perd toute écriture. Cette feature bascule les deux bases sur l'addon PostgreSQL Scalingo (une instance, schémas `public` pour Payload et `canonical` pour le store), et Postgres devient le moteur unique en dev (conteneur Docker dédié), en CI, en préprod et en prod.

**Hors scope :**
- Passage de la colonne `data` du canonical en `jsonb`.
- Outil de migration pour le store canonical (`drizzle-kit`) : l'amorçage idempotent suffit pour une table.
- Reprise des éditions faites dans la prod actuelle (conteneur éphémère, rien à récupérer côté disque).

---

## Décisions prises

| Sujet | Décision |
|---|---|
| Moteur | PostgreSQL, addon Scalingo, même région que l'app |
| Topologie | Une instance, deux schémas : `public` (Payload), `canonical` (store) |
| Payload | `@payloadcms/db-postgres`, `push` en dev seulement, migrations versionnées appliquées au démarrage via `prodMigrations` |
| Store canonical | Dialecte unique `pg-core` + `node-postgres`, `data` reste en `text`, amorçage `CREATE SCHEMA/TABLE IF NOT EXISTS` |
| Tests du store | PGlite en mémoire (remplace libSQL `:memory:`) |
| URL de connexion | `DATABASE_URI` (local, CI) sinon `SCALINGO_POSTGRESQL_URL` (injecté par Scalingo en prod et préprod) ; erreur explicite si aucune |
| Dev local | Conteneur Docker dédié (`docker-compose.yml`, service `postgres`) : bases `tee` (dev) et `tee_test` (tests d'intégration) créées au premier démarrage, volume nommé |
| Préprod | Addon PostgreSQL Scalingo (plus petite offre), bascule répétée ici avant la prod |
| CI | Service `postgres` sur `test` et `e2e` ; E2E = migrate + seed, plus de `.db` commitée |
| Seed prod | `UsersSeed` jamais exécuté en prod ; premier super-admin créé à la main |
| Media | `@payloadcms/storage-s3` vers **Scaleway Object Storage** (`fr-par`), activé par la présence de `S3_BUCKET` ; sans bucket, stockage disque inchangé |
| Pipeline quotidien | Option A tranchée : l'amont reste maître, tâche planifiée Scalingo (`cron.json`), hook CMS laissé actif (ses écritures sont écrasées par l'import) |

---

## Fichiers à créer / modifier

| Fichier | Action |
|---|---|
| `package.json` | Modifier : `@payloadcms/db-sqlite` → `@payloadcms/db-postgres`, `@libsql/client` → `pg` (+ `@types/pg` en dev), ajouter `@electric-sql/pglite` (dev), scripts `db:up`, `migrate`, `migrate:create` |
| `docker-compose.yml` | Créer : service `postgres` (version alignée sur l'addon), `POSTGRES_DB=tee`, port `5432`, volume nommé, healthcheck, montage de `docker/postgres/init/` |
| `docker/postgres/init/01-create-test-db.sql` | Créer : `CREATE DATABASE tee_test` (exécuté une seule fois, au premier démarrage du volume) |
| `apps/cms/payload.config.ts` | Modifier : `postgresAdapter({ pool: { connectionString, max }, migrationDir, prodMigrations })` |
| `apps/cms/src/config/Config.ts` | Créer (+ `objectStorage()` pour Scaleway) : point d'entrée unique des variables d'environnement du CMS (URL de base avec repli `SCALINGO_POSTGRESQL_URL`, taille du pool, secret Payload, URL publique), avec valeurs par défaut et erreurs explicites |
| `apps/cms/src/endpoints/agir/agirEndpoints.ts` | Modifier : `PUBLIC_BASE_URL` lu via `Config` |
| `apps/cms/src/migrations/` | Créer : migration initiale générée (`payload migrate:create initial`) + `index.ts` généré |
| `apps/cms/project.json` | Modifier : targets `migrate`, `migrate:create`, `migrate:status` (`payload migrate…`, cwd projet) |
| `apps/cms/.env.example` | Modifier : `DATABASE_URI` et `CANONICAL_DATABASE_URI` en `postgres://tee:tee@localhost:5432/tee` |
| `apps/cms/vitest.config.mts` | Modifier : base de test Postgres dédiée (`tee_test`) au lieu des fichiers `.db` |
| `apps/cms/tests/support/testDatabaseUrl.ts` | Créer : URL de la base de test partagée entre la config vitest et le global setup (ce dernier ne doit jamais lire `DATABASE_URI`) |
| `apps/cms/vitest.global-setup.ts` | Modifier : `DROP SCHEMA public, canonical CASCADE` puis recréation, au lieu de `rmSync` des fichiers |
| `apps/cms/src/scripts/seed/run.ts` | Modifier : `UsersSeed` exclu quand `NODE_ENV=production` (ou opt-in explicite) |
| `libs/canonical-store/src/schema.ts` | Modifier : `pgSchema('canonical').table('canonical_programs', …)` |
| `libs/canonical-store/src/db.ts` | Modifier : `drizzle-orm/node-postgres` + `Pool` borné, amorçage `CREATE SCHEMA IF NOT EXISTS` + `CREATE TABLE IF NOT EXISTS` |
| `libs/canonical-store/src/DrizzleCanonicalProgramRepository.ts` | Modifier : `create(url)` ouvre un pool Postgres ; ajouter une construction depuis une instance Drizzle déjà ouverte (PGlite en test) |
| `libs/canonical-store/src/createCanonicalProgramRepository.ts` | Modifier : `CANONICAL_DATABASE_URI` sinon `SCALINGO_POSTGRESQL_URL`, erreur explicite si aucune ; suppression du défaut ancré au workspace (`findWorkspaceRoot`) |
| `libs/canonical-store/tests/DrizzleCanonicalProgramRepository.spec.ts` | Modifier : PGlite au lieu de libSQL `:memory:` |
| `apps/cms/tests/unit/CanonicalProgramService.spec.ts` | Modifier : idem si elle ouvre un store réel |
| `libs/format-adapters/scripts/import-tee.ts` | Modifier : remplacement complet dans une transaction (`DELETE` + inserts) au lieu de dépendre d'un `rm -f` du fichier |
| `.github/workflows/ci.yml` | Modifier : service `postgres`, `DATABASE_URI`/`CANONICAL_DATABASE_URI` Postgres, étapes `migrate` + `seed` avant E2E |
| `.github/workflows/daily_data.yml` | Supprimer : remplacé par la tâche planifiée Scalingo |
| `cron.json` | Créer : tâche planifiée Scalingo quotidienne (`pnpm data:daily`) |
| `libs/format-adapters/src/tee/UpstreamJsonSource.ts` | Créer : lecture HTTP des fichiers amont (`TEE_PROGRAMS_URL` / `TEE_REDIRECTS_URL`), consommés en mémoire |
| `package.json` | Modifier : script `data:daily` ; `tsx` passe en dépendance de production (le conteneur Scalingo élague les devDependencies) |
| `.gitignore` | Modifier : ignorer `*.db` sans exception |
| `apps/cms/tee-poc.db`, `libs/canonical-store/canonical.db` | Supprimer du dépôt (`git rm`) après bascule |
| `CLAUDE.md` | Modifier : stack (PostgreSQL), sections `libs/canonical-store` et Seed, commandes `db:up`/`migrate`, index ADR |
| `docs/adr/0008-canonical-persistence-ddd.md` | Modifier : gap « Migration Postgres » renvoyé vers l'ADR 0012, défaut `canonical.db` marqué obsolète |

---

## Étapes d'implémentation

### Lot 1 : Postgres en local (aucun impact prod)

1. Créer `docker-compose.yml` (image `postgres` à la version majeure de l'addon Scalingo) et le script d'init `tee_test` ; scripts `db:up` (`docker compose up -d --wait`), `db:down` et `db:reset` (`docker compose down -v` puis `up`).
2. Remplacer l'adaptateur Payload par `postgresAdapter` avec `pool.max` borné (5 par défaut, surchargeable par `DATABASE_POOL_MAX`).
3. Démarrer en dev (`push` crée le schéma), vérifier l'admin, puis générer la migration initiale : `payload migrate:create initial`. Brancher `prodMigrations` sur `apps/cms/src/migrations/index.ts`.
4. Ajouter les targets NX `migrate`, `migrate:create`, `migrate:status`.
5. Vérifier le comportement du `select hasMany` imbriqué (ADR 0011) sous Postgres : le contournement `json` doit rester fonctionnel.

**Constats du lot 1 (fait) :**
- `Programs` redéclarait les options `draft`/`published` du champ `_status`. Payload fusionne ce champ avec son propre `_status` de brouillons en **concaténant** les options, ce qui donnait un enum Postgres à valeurs dupliquées (`CREATE TYPE … AS ENUM('draft', 'published', 'draft', 'published')`, rejeté). Les options sont désormais fournies par Payload seul (`options: []`), avec des libellés français identiques.
- `syncCanonicalOnPublish` relisait le dispositif sans passer `req` : lecture hors transaction, donc document non commité invisible et **blocage du pool** (seed figé à 0/234). Corrigé en passant `req`.
- La migration initiale produit un schéma strictement identique à celui du `push` de dev (comparaison `pg_dump -s`). Un démarrage `NODE_ENV=production` sur base vide l'applique via `prodMigrations`.
- Le contournement `json` de l'ADR 0011 fonctionne (colonne `jsonb`, table principale et table des versions).
- Les migrations générées sont exclues du lint (`eslint.config.mjs`), comme `payload-types.ts`.
- Tant que les lots 2 et 3 ne sont pas faits, les tests d'intégration et la CI (qui utilisent encore des URL `file:`) ne passent pas : la branche n'est pas fusionnable seule.

### Lot 2 : store canonical sur Postgres

6. Réécrire `schema.ts` en `pgSchema('canonical')`, `db.ts` en `node-postgres` avec amorçage du schéma et de la table.
7. Adapter `DrizzleCanonicalProgramRepository` (construction depuis une instance Drizzle Postgres) et `createCanonicalProgramRepository` (`CANONICAL_DATABASE_URI`, sinon `SCALINGO_POSTGRESQL_URL`, erreur explicite si aucune).
8. Passer les tests du store sur PGlite ; vérifier upsert, `findBySlug`, `findAll` et l'événement `program_dropped` en lecture.
9. Adapter `import-tee.ts` : remplacement complet transactionnel, pour refléter les suppressions amont sans effacer de fichier.

**Constats du lot 2 (fait) :**
- Port `CanonicalProgramRepository` enrichi d'un `deleteAll()` (reconstruction complète depuis l'amont), implémenté par le store et le fake du domaine.
- `DrizzleCanonicalProgramRepository` accepte désormais soit une URL (`.create`), soit une connexion déjà ouverte (`.fromDb`), ce qui permet PGlite en test.
- PGlite est isolé dans `src/testing/InMemoryCanonicalDb.ts`, accessible par le chemin `@tee-backoffice/canonical-store/testing` (nouvelle entrée dans `tsconfig.base.json` et `apps/cms/tsconfig.json`) pour ne pas l'embarquer dans le bundle applicatif.
- `import:tee` vide le store après la validation des entrées (jamais avant), puis réécrit tout : plus besoin de supprimer un fichier au préalable. Vérifié idempotent (240 dispositifs sur deux exécutions consécutives).
- `libs/canonical-store/canonical.db` (libSQL) est devenu inutilisable : sa suppression du dépôt est traitée au lot 5, avec celle de `tee-poc.db`.

### Lot 3 : seed, tests d'intégration, CI

10. Rendre `UsersSeed` inactif en prod ; vérifier que `pnpm seed` complet fonctionne sur une base vide migrée.
11. Adapter `vitest.config.mts` et `vitest.global-setup.ts` (base `tee_test`, reset par `DROP SCHEMA … CASCADE`).
12. CI : service `postgres` sur `test` et `e2e`, variables d'environnement, étapes `pnpm migrate` puis `pnpm seed` avant `pnpm e2e`. Supprimer la dépendance à `tee-poc.db` commitée.
13. Lint, typecheck, tests unitaires, intégration et E2E verts.

**Constats du lot 3 (fait) :**
- `UsersSeed` est ignoré quand `NODE_ENV=production` (message explicite), le reste du seed tourne normalement.
- Les tests d'intégration visent `tee_test` (surchargeable par `TEST_DATABASE_URI`, utilisé par la CI) ; `vitest.global-setup.ts` supprime les schémas `public` et `canonical` avant chaque exécution au lieu d'effacer des fichiers.
- CI : service `postgres:17-alpine` sur les jobs `test` (accès par `localhost`) et `e2e` (job en conteneur, accès par le nom `postgres`). Le job E2E enchaîne build, `pnpm migrate`, `pnpm seed`, Playwright : plus aucune dépendance à une base commitée.
- **Piège trouvé** : un seed lancé en mode dev pousse le schéma et marque la base comme « poussée en dev » (ligne `dev`, batch -1 de `payload_migrations`). Le démarrage suivant en production demande alors une confirmation interactive et le serveur ne répond jamais (E2E en échec sur un timeout). D'où le `NODE_ENV: production` sur l'étape de seed de la CI.
- **Piège trouvé (corrigé)** : les variables déclarées dans `test.env` de vitest ne s'appliquent qu'aux fichiers de test, **pas au global setup**. Une première version lisait `DATABASE_URI` dans le global setup et a donc vidé la base de **dev**. L'URL de test vit désormais dans une constante partagée (`tests/support/testDatabaseUrl.ts`).
- Vérifié en local dans les conditions de la CI : migrations puis seed sur base vierge, build de production, 7 tests E2E verts, 22 tests d'intégration verts.
- `apps/cms/tee-poc.db` et `libs/canonical-store/canonical.db` ne servent plus à rien mais restent commités : leur suppression est au lot 5.

### Lot 4 : décision pipeline et Media

14. ~~Trancher la question ouverte de l'ADR 0012~~ **fait** : option A (amont maître), hook laissé actif, ADR passé en « Accepté ».
15. **Fait** : `daily_data.yml` supprimé, remplacé par `cron.json` (tâche planifiée Scalingo) et le script `pnpm data:daily` (import distant, amorçage Grist, export Grist avec push). Les fichiers amont sont lus par HTTP (`UpstreamJsonSource`), plus aucun commit de données. Le hook reste actif, conformément à la décision.
16. **Fait** : `@payloadcms/storage-s3` branché sur Scaleway Object Storage, activé par la présence de `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (`Config.objectStorage()`), sinon stockage disque local inchangé. Vérifié dans les deux cas au démarrage (`media adapter = local disk` / `s3`). Reste à créer le bucket et à poser les variables sur les apps Scalingo.

### Lot 5 : bascule (préprod, puis prod)

Les étapes 17 à 21 se font d'abord sur la **préprod**, puis à l'identique sur la **prod** une fois la préprod validée.

17. Provisionner l'addon PostgreSQL Scalingo. Aucune variable de base à définir : le DSN est injecté dans `SCALINGO_POSTGRESQL_URL` et l'app le lit en repli de `DATABASE_URI` / `CANONICAL_DATABASE_URI`.
18. Vérifier que les dépendances nécessaires au seed (`tsx`, `nx`) sont disponibles dans le conteneur Scalingo (le buildpack Node peut élaguer les `devDependencies`) ; sinon prévoir un script de seed prod compilé ou déplacer les dépendances requises.
19. Déployer : au démarrage, `prodMigrations` crée le schéma Payload ; le store amorce `canonical`.
20. `scalingo run` : seed des référentiels (sans utilisateurs de dev), puis création manuelle du premier super-admin.
21. Contrôles : connexion admin, édition et publication d'un dispositif, présence dans `/api/agir/…`, **redéploiement puis vérification que les données sont toujours là**.
22. Nettoyage : `git rm` des deux `.db`, `.gitignore`, mise à jour de `CLAUDE.md`, ADR 0008 et mémos obsolètes.

---

## Vérification

```sh
pnpm db:up                                       # Postgres local
pnpm nx run @tee-backoffice/cms:migrate          # applique les migrations
pnpm seed                                        # seed complet sur base vide
pnpm nx run @tee-backoffice/canonical-store:test # store sur PGlite
pnpm test:unit && pnpm test                      # unitaires + intégration
pnpm lint && pnpm typecheck
pnpm build && pnpm e2e
```

En prod (Scalingo) :
- `scalingo --app <app> pgsql-console` : les schémas `public` et `canonical` existent, `canonical.canonical_programs` est peuplée.
- Publier un dispositif, redéployer, vérifier qu'il est toujours présent dans l'admin et dans les endpoints AGIR.
- Vérifier qu'aucun compte `@tee.test` n'existe en base de prod.
