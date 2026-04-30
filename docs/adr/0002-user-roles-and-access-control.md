# ADR 0002 — Rôles utilisateurs et contrôle d'accès

**Date :** 2026-03-16 (révisé 2026-04-30)
**Statut :** Accepté

> **Révision 2026-04-30 :** la matrice de rôles a été refondue par l'[ADR 0005](0005-programs-workflow-extended.md). Les rôles `administrateur-aide`, `contributeur` et `observateur` sont remplacés par `admin` et `creator`. Les sections ci-dessous reflètent l'état courant. L'historique des décisions initiales est conservé dans le ticket d'ADR 0004.

---

## Contexte

La documentation produit (`docs/sources/Gestion des droits...`) et le diagramme `docs/sources/workflow-programs.png` définissent les acteurs principaux du backoffice : `super-admin`, `admin` (opérateur de dispositifs) et `creator` (créateur de dispositif). La collection `Users` existante ne portait aucune notion de rôle. Ce document décrit les choix d'implémentation retenus pour le POC.

---

## Décision

### 1. Rôles stockés en champ `select` sur `Users`

Trois rôles sont définis directement sur la collection `users` via un champ `select` :

| Rôle | Description |
|---|---|
| `super-admin` | Accès complet (CRUD + import + delete) sur toutes les collections |
| `admin` | CRUD sur les aides de son opérateur, édition de son organisation. Mêmes droits que `super-admin` pour le POC, distinction conservée pour évolutions futures |
| `creator` | Création et édition des aides assignées uniquement |

Les rôles suivent une hiérarchie stricte : `super-admin` > `admin` > `creator`. Un rôle supérieur hérite des droits de tous les rôles inférieurs. Cette hiérarchie est encodée dans `UserRole.HIERARCHY` et exposée via les méthodes `isAtLeast`, `isSuperAdmin`, `isAdmin`, `isCreator` de la classe `UserRole` :

| méthode | creator | admin | super-admin |
|---|---|---|---|
| `isSuperAdmin` | ❌ | ❌ | ✅ |
| `isAdmin` | ❌ | ✅ | ✅ |
| `isCreator` | ✅ | ✅ | ✅ |

**Pourquoi un champ `select` et non un système RBAC externe ?**
Dans le cadre d'un POC, stocker le rôle directement sur l'utilisateur est suffisant. Cela évite d'introduire une dépendance externe (ex. Casbin, CASL) et s'intègre nativement à l'admin Payload. Une migration vers un système RBAC dédié est possible ultérieurement si les besoins évoluent.

Champs additionnels sur `Users` :
- `operator` — relation vers `operators`, visible si rôle ≠ super-admin, définit le périmètre de l'admin aide
- `region` — texte libre, optionnel (ex : "Grand Est")
- `team` — texte requis (ex : "CCI Grand Est")

### 2. Access control en classes statiques dans `src/services/access/`

Les règles d'accès sont implémentées sous forme de classes statiques dans `apps/cms/src/services/access/` :

```
AuthAccessPolicy.ts     — isAuthenticated, isSuperAdmin, isAdmin
ProgramAccessPolicy.ts  — read/create/update/delete scoped par rôle
OperatorAccessPolicy.ts — read/update scoped par rôle
```

**Pourquoi des classes statiques ?**
Les méthodes statiques sont équivalentes à des fonctions pures (sans état) tout en permettant un regroupement sémantique par domaine et en facilitant l'import groupé.

### 3. `assignedContributors` en relation directe sur Programs

Un champ `assignedContributors` (relation `hasMany` vers `users`) est ajouté directement sur `Programs`. Il définit la liste des utilisateurs autorisés à **modifier** un programme. Le hook `assignCreatorOnCreate` y ajoute automatiquement l'utilisateur courant lorsqu'un `creator` crée un programme — le créateur initial est donc toujours assigné.

**Read (lecture)** — un `creator` rattaché à un opérateur voit dans la liste **tous les programmes de son opérateur** (`{ operator: { equals: user.operator } }`). À défaut d'opérateur rattaché, le filtre retombe sur `{ assignedContributors: { contains: user.id } }`.

**Update (édition)** — la clause `access.update` retourne `{ assignedContributors: { contains: user.id } }` pour le rôle `creator`. Tout programme visible mais hors de cette liste s'ouvre en **lecture seule** dans l'admin (Payload affiche les champs en read-only quand l'access update échoue sur ce document précis).

Cela répond au besoin : un créateur voit l'ensemble des programmes de son opérateur, mais ne peut éditer que ceux qu'il a créés ou pour lesquels il a été ajouté à `assignedContributors`.

**Pourquoi pas une table de jointure séparée ?**
Une relation directe suffit pour le POC. Une table de jointure apporterait plus de flexibilité (métadonnées d'assignation, historique) mais complexifie la stack sans bénéfice immédiat.

### 4. Système `versions/drafts` Payload sur Programs

Le cycle de vie éditorial des programmes est géré via le système natif `versions: { drafts: true }` de Payload. Le champ `_status` injecté par Payload est surchargé en sidebar avec un `access.update` restreint :

| Valeur `_status` | Description |
|---|---|
| `draft` | Brouillon (valeur par défaut à la création) |
| `published` | Publié (visible via l'API avec `draft: false`) |

`_status` est synchronisé automatiquement par le hook `beforeChangeWorkflow` à partir du champ métier `workflowStatus` (cf. ADR 0005) — aucune écriture directe via l'UI standard.

Les droits de publication sont contraints par rôle via `access.update` sur le champ `_status` :
- `super-admin` et `admin` : peuvent modifier `_status` (publier ou dépublier)
- `creator` : peut sauvegarder en brouillon, mais `_status` est en lecture seule — ne peut pas publier

L'admin UI utilise un `WorkflowActionBar` custom (cf. ADR 0005) qui pilote les transitions métier ; l'historique des versions Payload reste accessible (table `_programs_v` en base).

### 5. Visibilité des collections dans la sidebar admin

La propriété `admin.hidden` de Payload contrôle l'affichage d'une collection dans le menu de navigation, indépendamment des règles d'accès API.

Seule la collection `Programs` est visible pour tous les rôles. Les collections `Users`, `Media`, `Operators` et `Projects` sont réservées au `super-admin` via `admin.hidden: ({ user }) => !UserRole.isSuperAdmin(user)`.

| Collection | creator | admin | super-admin |
|---|---|---|---|
| Programs | ✅ visible | ✅ visible | ✅ visible |
| Users | ❌ masqué | ❌ masqué | ✅ visible |
| Media | ❌ masqué | ❌ masqué | ✅ visible |
| Operators | ❌ masqué | ❌ masqué | ✅ visible |
| Projects | ❌ masqué | ❌ masqué | ✅ visible |

**Pourquoi `admin.hidden` et non une restriction sur `access.read` ?**
`admin.hidden` est l'outil Payload dédié à la visibilité UI, orthogonal à la sécurité API. Modifier `access.read` pour cacher des collections aurait des effets de bord sur les requêtes API internes (ex. chargement des relations dans les formulaires). Pour le POC, la restriction est UI-only — les endpoints API restent accessibles aux utilisateurs authentifiés.

### 6. `_status: 'published'` pour les données seedées

Les programmes importés depuis `docs/sources/programs.json` reçoivent `_status: 'published'` car ils proviennent de données de production. Les nouveaux programmes créés dans l'admin reçoivent `_status: 'draft'` par défaut (comportement natif Payload).

---

## Conséquences

- La collection `users` expose `role`, `operator`, `region`, `team` dans l'admin Payload.
- La collection `programs` expose `_status` et `assignedContributors` en sidebar.
- Les `payload-types.ts` doivent être régénérés après toute modification de schéma : `node_modules/.bin/payload generate:types` depuis `apps/cms/`.
- Un utilisateur sans rôle explicite reçoit le rôle par défaut `creator`.
- L'access control ne protège pas les routes API REST directement exposées hors Payload — à sécuriser si le POC évolue.
