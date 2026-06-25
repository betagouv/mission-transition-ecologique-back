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

### 5. Synchronisation au publish (chemin unique)

- Hook `syncCanonicalOnPublish` (afterChange sur `Programs`) : un dispositif publié (`_status === 'published'`) est mappé, validé, persisté. Les issues sont **émises comme événements** (`program_dropped`, `sync_failed`) via le sink (voir §6) et **ne bloquent jamais** l'écriture CMS.
- Le **seed** n'a **pas** d'étape canonical dédiée : `ProgramMapper` écrit les dispositifs publiés en `_status: 'published'`, ce qui déclenche le même hook. Le store est donc peuplé par le hook, en seed comme en prod (un seul chemin de sync). Une étape batch `CanonicalSeed` a existé puis a été retirée car redondante avec le hook (elle resynchronisait le même ensemble, doublant le travail et les logs).

### 6. Observabilité des drops via un port à canaux pluggables

La validation écarte de la donnée à deux endroits, sans le signaler : à l'**écriture** (au publish, hook : un input invalide n'est pas persisté) et surtout à la **lecture** (`findAll`/`findBySlug` : une row stockée qui ne valide plus, typiquement après une évolution de schéma, disparaît silencieusement). Ce dernier cas est quasi invisible.

Décision : un **port d'observabilité** `CanonicalEventSink` dans le domaine (`libs/canonical/src/observability/`). Le domaine et le store **émettent** des `CanonicalEvent` typés (`program_saved`, `program_dropped` avec `phase: 'write' | 'read'`, `sync_failed`) sans savoir où ils partent. `emit` est fire-and-forget et ne jette jamais : l'observabilité ne peut pas casser un save ni une lecture.

Les **canaux** sont des adaptateurs implémentant le port, injectés au composition root (`apps/cms`) :
- `PayloadLoggerEventSink` (logs, toujours actif aujourd'hui).
- Points d'extension documentés (Sentry, email, Slack) : ajouter un canal = une classe + une route, sans toucher au domaine ni au store.

Le **routage** est déclaratif : `RoutingCanonicalEventSink` dispatche chaque événement vers tous les canaux dont le filtre matche (un événement peut donc atteindre plusieurs canaux), et `CompositeEventSink` groupe plusieurs canaux derrière une seule route (ex. envoyer toute erreur par email **et** Slack). La config vit dans `canonicalEventSink.ts` (composition root).

### 7. Périmètre actuel : aller simple, lossy, publiés

- **Aller simple** `CMS → canonical` (le retour `canonical → CMS` et les flux entrants viendront plus tard).
- **Lossy assumé** : on perd le propre au CMS (`workflowHistory`, contributeurs assignés…), on garde la donnée métier du dispositif.
- **Publiés uniquement** (les brouillons sont hors sujet pour l'instant).

## Conséquences

**Positif**
- Changer de CMS = réécrire l'adaptateur (mapper) et éventuellement le composition root. Domaine, port, service et store restent inchangés ; le canonical persisté survit.
- Testabilité : domaine testé avec un fake repository (framework-free) ; infra testée en libSQL `:memory:` ; injection mockable.

**Coûts / limites**
- Une base et une couche d'accès supplémentaires, indépendantes de Payload.
- Population du canonical par effet de bord du hook (y compris au seed) plutôt que par une étape explicite : si un import bulk désactivait les hooks, le store ne serait pas alimenté. Acceptable ici car le seed publie via Payload (hooks actifs) ; un script de réconciliation batch reste possible plus tard si besoin.

**Gaps connus (à traiter ailleurs)**
- Pas de suppression du canonical sur unpublish / archive (l'entrée reste).
- Gate de validation **bloquante** au publish pas encore en place : aujourd'hui le hook émet un événement et n'écrit pas l'invalide (les drops écriture/lecture sont désormais observables, cf. §6).
- Fiabilisation du **mapping durée** dans le seed (`ProgramMapper`) : certains dispositifs `etude` / `formation` n'ont pas de `duree` en source et sont donc rejetés par la règle `refineDuree` (volontairement conservée). Fix prévu dans une autre PR.
- Migration **Postgres** (Payload + store) à venir.

**Contrainte technique**
- Les libs `canonical` et `canonical-store` portent un `package.json` minimal avec `"type": "module"` : sans lui, node / `tsx` (le seed) traite leurs `.ts` comme du CommonJS et le linking des exports nommés ESM casse.

## Alternatives écartées

- **Colonne JSON sur `Programs`** : couple l'artefact canonique à la row du CMS et se désynchronise facilement. Rejeté.
- **Génération « à la volée » sans persistance** : rend la donnée dépendante du CMS pour exister, à l'opposé de l'objectif anti-lock-in. Rejeté une fois le canonical promu source de vérité.
- **Prisma plutôt que Drizzle** : Payload utilise déjà Drizzle en interne ; Drizzle est plus léger pour un store mono-table et flexible sur le dialecte (SQLite aujourd'hui, Postgres demain). Drizzle retenu.
