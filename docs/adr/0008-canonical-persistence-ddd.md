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
- Colonne `data` en **TEXT JSON** pour rester portable. La migration Postgres future (Payload migrera aussi) se limite à changer `schema.ts` (dialecte) et `db.ts` (driver), sans toucher au domaine, au port, ni au CMS.

### 4. Injection au composition root (pattern `new Service(new Repo())`)

Les **ports** vivent dans le domaine, les **implémentations concrètes** sont injectées depuis `apps/cms` :

- `getCanonicalProgramRepository()` et `getCanonicalProgramService()` : singletons async mémoïsés qui câblent l'impl libSQL dans le service domaine.
- Le **mapping Payload → canonical** (`ProgramCanonicalMapper`) et l'**adaptateur markdown** (`PayloadRichTextToMarkdown`, derrière le port `RichTextToMarkdown`) restent côté `apps/cms` : c'est le couplage CMS, assumé et remplaçable.
- Nommage **par entité** (`canonicalProgramService.ts` / `getCanonicalProgramService`) pour préparer un futur `CanonicalProjectService`.

### 5. Synchronisation au publish + seed

- Hook `syncCanonicalOnPublish` (afterChange sur `Programs`) : un dispositif publié (`_status === 'published'`) est mappé, validé, persisté. Les échecs sont **loggés et ne bloquent jamais** l'écriture CMS.
- Étape `CanonicalSeed` (batch, sélection `workflowStatus === 'publie'`) réutilise **le même** `CanonicalProgramService`. Hook et seed alimentent donc le store par la même logique.

### 6. Périmètre actuel : aller simple, lossy, publiés

- **Aller simple** `CMS → canonical` (le retour `canonical → CMS` et les flux entrants viendront plus tard).
- **Lossy assumé** : on perd le propre au CMS (`workflowHistory`, contributeurs assignés…), on garde la donnée métier du dispositif.
- **Publiés uniquement** (les brouillons sont hors sujet pour l'instant).

## Conséquences

**Positif**
- Changer de CMS = réécrire l'adaptateur (mapper) et éventuellement le composition root. Domaine, port, service et store restent inchangés ; le canonical persisté survit.
- Testabilité : domaine testé avec un fake repository (framework-free) ; infra testée en libSQL `:memory:` ; injection mockable.

**Coûts / limites**
- Une base et une couche d'accès supplémentaires, indépendantes de Payload.
- Redondance partielle entre le hook (au fil de l'eau) et le seed (batch), mais idempotente (upsert).

**Gaps connus (à traiter ailleurs)**
- Pas de suppression du canonical sur unpublish / archive (l'entrée reste).
- Gate de validation **bloquante** au publish pas encore en place : aujourd'hui le hook loggue et n'écrit pas l'invalide.
- Fiabilisation du **mapping durée** dans le seed (`ProgramMapper`) : certains dispositifs `etude` / `formation` n'ont pas de `duree` en source et sont donc rejetés par la règle `refineDuree` (volontairement conservée). Fix prévu dans une autre PR.
- Migration **Postgres** (Payload + store) à venir.

**Contrainte technique**
- Les libs `canonical` et `canonical-store` portent un `package.json` minimal avec `"type": "module"` : sans lui, node / `tsx` (le seed) traite leurs `.ts` comme du CommonJS et le linking des exports nommés ESM casse.

## Alternatives écartées

- **Colonne JSON sur `Programs`** : couple l'artefact canonique à la row du CMS et se désynchronise facilement. Rejeté.
- **Génération « à la volée » sans persistance** : rend la donnée dépendante du CMS pour exister, à l'opposé de l'objectif anti-lock-in. Rejeté une fois le canonical promu source de vérité.
- **Prisma plutôt que Drizzle** : Payload utilise déjà Drizzle en interne ; Drizzle est plus léger pour un store mono-table et flexible sur le dialecte (SQLite aujourd'hui, Postgres demain). Drizzle retenu.
