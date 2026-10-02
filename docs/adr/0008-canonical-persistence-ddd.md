# ADR 0008 : Persistance du canonical et architecture DDD / injection de dépendances

**Date :** 2026-06-22
**Statut :** Accepté
**Décideurs :** Yohann (front)

---

## Contexte

L'ADR 0007 a posé le format pivot `libs/canonical` (domaine pur, zod). Restait ouvert : **où vit la donnée canonique** et **comment relier le CMS au pivot**.

Décision produit prise dans cette itération : le **canonical devient la source de vérité durable** (anti-lock-in). Le CMS (Payload) n'est plus qu'un **outil d'édition remplaçable**. Si demain on change de CMS, on doit pouvoir réutiliser la donnée au format canonique.

Vision « hub » : plusieurs **adaptateurs entrants** alimentent le canonical (le CMS aujourd'hui via un mapper, des flux externes demain). Le CMS pourra aussi **éditer** le canonical via un retour `canonical → CMS` (phase ultérieure).

La règle de dépendance qui en découle : elle pointe **toujours vers le domaine**, jamais l'inverse.

## Décision

### 1. Architecture hexagonale / DDD

Trois couches, dépendances orientées vers le domaine :

```
apps/cms (adaptateur CMS + composition root) ──▶ libs/canonical (domaine)
libs/canonical-store (infra libSQL/Drizzle)  ──▶ libs/canonical (domaine)
```

`libs/canonical` ne dépend de rien d'autre (ni Payload, ni driver DB).

### 2. Port de persistance + service de domaine (dans `libs/canonical`)

- **Port** `CanonicalProgramRepository` (interface `save` / `findBySlug`). Le domaine définit le contrat, il ignore la techno de stockage.
- **Service** `CanonicalProgramService.save(input)` : valide (via `CanonicalProgramValidator`, instancié en interne) puis **upsert** via le port injecté. Porte la règle métier « seul un canonical valide est persisté ». Source-agnostique (réutilisable par le CMS et de futurs flux). Retourne un résultat discriminé `saved | invalid`.

### 3. Store libSQL/Drizzle indépendant de Payload (`libs/canonical-store`)

> ⚠️ **Caduc depuis l'ADR 0012** : le store tourne désormais sur **PostgreSQL**, dans un schéma dédié `canonical` de la base de Payload. Le principe (adaptateur d'un port, indépendant du CMS) reste valable ; libSQL, le fichier `canonical.db` et sa résolution par défaut ne le sont plus.

- `DrizzleCanonicalProgramRepository` implémente le port (libSQL + Drizzle).
- Base **dédiée** `canonical.db` (variable `CANONICAL_DATABASE_URI`, défaut `file:./canonical.db`), **distincte** de la base Payload : la donnée canonique survit à un changement de CMS.
- La **localisation de la DB est portée par le store** : la factory `createCanonicalProgramRepository()` résout elle-même `CANONICAL_DATABASE_URI` et retourne un repository prêt à l'emploi. Le CMS demande un repository configuré sans connaître l'emplacement ni le driver.
- Défaut **ancré au workspace** (`libs/canonical-store/canonical.db`, commitée à côté du package), résolu en remontant du CWD jusqu'au marqueur `pnpm-workspace.yaml` (pas `import.meta.url`, peu fiable sous les transforms de test/bundler). Tous les points d'entrée (seed, CMS dev/start) lisent ainsi le même fichier quel que soit le répertoire de lancement, sans dépendre d'un chemin relatif au CWD.
- Colonne `data` en **TEXT JSON** pour rester portable. La migration Postgres future (Payload migrera aussi) se limite à changer `schema.ts` (dialecte) et `db.ts` (driver), sans toucher au domaine, au port, ni au CMS.

### 4. Injection au composition root (pattern `new Service(new Repo())`)

Les **ports** vivent dans le domaine, les **implémentations concrètes** sont injectées depuis `apps/cms` :

- `getCanonicalProgramRepository()` et `getCanonicalProgramService()` : singletons async mémoïsés. Le premier ne fait que mémoïser le repository clé en main du store (`createCanonicalProgramRepository()`) ; le second l'injecte dans le service domaine.
- Le **mapping Payload → canonical** (`ProgramCanonicalMapper`) et l'**adaptateur markdown** (`PayloadRichTextToMarkdown`, derrière le port `RichTextToMarkdown`) restent côté `apps/cms` : c'est le couplage CMS, assumé et remplaçable.
- Nommage **par entité** (`canonicalProgramService.ts` / `getCanonicalProgramService`) pour préparer un futur `CanonicalProjectService`.

> **Révision 2026-10-01** ([ADR 0014](0014-canonical-projects.md), feature 008) : `CanonicalProjectService` existe. Les projets ont leur modèle (`libs/canonical/src/canonical-project/`), leur port `CanonicalProjectRepository`, leur table `canonical.canonical_projects` et leur composition root (`canonicalProjectRepository.ts`, `canonicalProjectService.ts`), sur le même schéma que les dispositifs. Le diff et le garde-fou de snapshot sont partagés par les deux entités (`libs/canonical/src/snapshot/`), et les événements d'observabilité (§6) gagnent `project_saved`, `project_removed`, `project_dropped` ainsi qu'un champ `entity` sur `sync_failed`. Après revue de code, le même jour : les singletons du CMS oublient une promesse rejetée (`RetryableMemo`, l'appel suivant réessaie) ; `delete` des deux ports renvoie un booléen et l'événement de retrait n'est émis que si une ligne a été retirée ; à l'écriture, les repositories évincent la ligne de même slug stockée sous un autre identifiant, ce qui supprime les `sync_failed` sur l'unicité du slug.

### 5. Synchronisation au publish (chemin unique)

- Hook `syncCanonicalOnPublish` (afterChange sur `Programs`) : l'action dépend du `workflowStatus`, décidée par `CanonicalSyncPolicy` (révisé le 2026-09-25, feature 005) :
  - `publie`, `archive`, `remplace` : le dispositif est mappé, validé, persisté. Archivé et remplacé sont transmis avec leur statut (`statut_edition: 'pret_prod'`, `statut_dispositif: 'archive'` ou `'remplace'`) : l'API AGIR continue de les servir en les signalant comme tels, l'export Grist (open data) les écarte. Auparavant seul `_status === 'published'` était synchronisé : un dispositif archivé depuis le CMS restait `valide` dans le canonical, et son `statut_edition` aurait été `archive`, ce qui l'aurait fait disparaître de l'API AGIR (404) alors que l'archivage doit y être transmis.
  - `annule` : le dispositif est retiré du canonical (`CanonicalProgramService.remove`, événement `program_removed`).
  - états en cours (`en-creation`, `en-relecture`, `en-cours-publication`, `en-cours-modification`, `importe`) : le canonical n'est pas touché, la version publiée reste en ligne pendant une réécriture.
- Hook `removeCanonicalOnDelete` (afterDelete) : une suppression définitive retire aussi le dispositif du canonical (port `CanonicalProgramRepository.delete`).
- Les issues sont **émises comme événements** (`program_dropped`, `sync_failed`) via le sink (voir §6) et **ne bloquent jamais** l'écriture CMS.
- Le **seed** n'a **pas** d'étape canonical dédiée : `ProgramMapper` écrit les dispositifs publiés en `_status: 'published'`, ce qui déclenche le même hook. Le store est donc peuplé par le hook, en seed comme en prod (un seul chemin de sync). Une étape batch `CanonicalSeed` a existé puis a été retirée car redondante avec le hook (elle resynchronisait le même ensemble, doublant le travail et les logs).

### 6. Observabilité des drops via un port à canaux pluggables

La validation écarte de la donnée à deux endroits, sans le signaler : à l'**écriture** (au publish, hook : un input invalide n'est pas persisté) et surtout à la **lecture** (`findAll`/`findBySlug` : une row stockée qui ne valide plus, typiquement après une évolution de schéma, disparaît silencieusement). Ce dernier cas est quasi invisible.

Décision : un **port d'observabilité** `CanonicalEventSink` dans le domaine (`libs/canonical/src/observability/`). Le domaine et le store **émettent** des `CanonicalEvent` typés (`program_saved`, `program_removed`, `program_dropped` avec `phase: 'write' | 'read'`, `sync_failed`) sans savoir où ils partent. `emit` est fire-and-forget et ne jette jamais : l'observabilité ne peut pas casser un save ni une lecture.

Les **canaux** sont des adaptateurs implémentant le port, injectés au composition root (`apps/cms`) :
- `PayloadLoggerEventSink` (logs, toujours actif aujourd'hui).
- Points d'extension documentés (Sentry, email, Slack) : ajouter un canal = une classe + une route, sans toucher au domaine ni au store.

Le **routage** est déclaratif : `RoutingCanonicalEventSink` dispatche chaque événement vers tous les canaux dont le filtre matche (un événement peut donc atteindre plusieurs canaux), et `CompositeEventSink` groupe plusieurs canaux derrière une seule route (ex. envoyer toute erreur par email **et** Slack). La config vit dans `canonicalEventSink.ts` (composition root).

### 7. Périmètre actuel : aller simple, lossy, publiés

- **Aller simple** `CMS → canonical` (le retour `canonical → CMS` et les flux entrants viendront plus tard).
- **Lossy assumé** : on perd le propre au CMS (`workflowHistory`, contributeurs assignés…), on garde la donnée métier du dispositif.
- **Publiés, archivés et remplacés** (les brouillons restent hors sujet, voir §5).

## Conséquences

**Positif**
- Changer de CMS = réécrire l'adaptateur (mapper) et éventuellement le composition root. Domaine, port, service et store restent inchangés ; le canonical persisté survit.
- Testabilité : domaine testé avec un fake repository (framework-free) ; infra testée en base en mémoire (libSQL à l'époque, PGlite depuis l'ADR 0012) ; injection mockable.

**Coûts / limites**
- Une base et une couche d'accès supplémentaires, indépendantes de Payload.
- Population du canonical par effet de bord du hook (y compris au seed) plutôt que par une étape explicite : si un import bulk désactivait les hooks, le store ne serait pas alimenté. Acceptable ici car le seed publie via Payload (hooks actifs) ; un script de réconciliation batch reste possible plus tard si besoin.

**Gaps connus (à traiter ailleurs)**
- Pas de suppression du canonical sur unpublish / archive (l'entrée reste).
- Gate de validation **bloquante** au publish pas encore en place : aujourd'hui le hook émet un événement et n'écrit pas l'invalide (les drops écriture/lecture sont désormais observables, cf. §6).
- Fiabilisation du **mapping durée** dans le seed (`ProgramMapper`) : certains dispositifs `etude` / `formation` n'ont pas de `duree` en source et sont donc rejetés par la règle `refineDuree` (volontairement conservée). Fix prévu dans une autre PR.
- Migration **Postgres** (Payload + store) : réalisée, voir ADR 0012. La base « dédiée » y devient un **schéma dédié** (`canonical`) dans la base de Payload : compromis assumé, réversible par simple configuration, documenté dans l'ADR 0012 §2. Le store vit désormais dans le schéma `canonical` d'une base PostgreSQL ; les mentions de libSQL et du défaut `canonical.db` ci-dessus sont caduques.

**Contrainte technique**
- Les libs `canonical` et `canonical-store` portent un `package.json` minimal avec `"type": "module"` : sans lui, node / `tsx` (le seed) traite leurs `.ts` comme du CommonJS et le linking des exports nommés ESM casse.

## Alternatives écartées

- **Colonne JSON sur `Programs`** : couple l'artefact canonique à la row du CMS et se désynchronise facilement. Rejeté.
- **Génération « à la volée » sans persistance** : rend la donnée dépendante du CMS pour exister, à l'opposé de l'objectif anti-lock-in. Rejeté une fois le canonical promu source de vérité.
- **Prisma plutôt que Drizzle** : Payload utilise déjà Drizzle en interne ; Drizzle est plus léger pour un store mono-table et flexible sur le dialecte (SQLite aujourd'hui, Postgres demain). Drizzle retenu.
