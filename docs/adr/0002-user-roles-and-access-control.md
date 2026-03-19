# ADR 0002 — Rôles utilisateurs et contrôle d'accès

**Date :** 2026-03-16
**Statut :** Accepté

---

## Contexte

La documentation produit (`docs/sources/Gestion des droits...`) définit quatre personas avec des droits distincts sur les modules Catalogue, Écosystème, Pilotage et Diffusion. La collection `Users` existante ne portait aucune notion de rôle. Ce document décrit les choix d'implémentation retenus pour le POC.

---

## Décision

### 1. Rôles stockés en champ `select` sur `Users`

Quatre rôles sont définis directement sur la collection `users` via un champ `select` :

| Rôle | Description |
|---|---|
| `super-admin` | Accès complet (CRUD + import + delete) sur toutes les collections |
| `administrateur-aide` | CRUD sur les aides de son opérateur, édition de son organisation |
| `contributeur` | Édition des aides assignées uniquement |
| `observateur` | Lecture seule |

Les rôles suivent une hiérarchie stricte : `super-admin` > `administrateur-aide` > `contributeur` > `observateur`. Un rôle supérieur hérite des droits de tous les rôles inférieurs. Cette hiérarchie est encodée dans `UserRole.HIERARCHY` et exposée via les méthodes `isAtLeast`, `isSuperAdmin`, `isAdminAide`, `isContributeur`, `isObservateur` de la classe `UserRole` :

| méthode | observateur | contributeur | administrateur-aide | super-admin |
|---|---|---|---|---|
| `isSuperAdmin` | ❌ | ❌ | ❌ | ✅ |
| `isAdminAide` | ❌ | ❌ | ✅ | ✅ |
| `isContributeur` | ❌ | ✅ | ✅ | ✅ |
| `isObservateur` | ✅ | ✅ | ✅ | ✅ |

**Pourquoi un champ `select` et non un système RBAC externe ?**
Dans le cadre d'un POC, stocker le rôle directement sur l'utilisateur est suffisant. Cela évite d'introduire une dépendance externe (ex. Casbin, CASL) et s'intègre nativement à l'admin Payload. Une migration vers un système RBAC dédié est possible ultérieurement si les besoins évoluent.

Champs additionnels sur `Users` :
- `operator` — relation vers `operators`, visible si rôle ≠ super-admin, définit le périmètre de l'admin aide
- `region` — texte libre, optionnel (ex : "Grand Est")
- `team` — texte requis (ex : "CCI Grand Est")

### 2. Access control en classes statiques dans `src/services/access/`

Les règles d'accès sont implémentées sous forme de classes statiques dans `apps/cms/src/services/access/` :

```
AuthAccessPolicy.ts    — isAuthenticated, isSuperAdmin, isAdminOrAbove
ProgramAccessPolicy.ts — read/create/update/delete scoped par rôle
OperatorAccessPolicy.ts — read/update scoped par rôle
```

**Pourquoi des classes statiques ?**
Les méthodes statiques sont équivalentes à des fonctions pures (sans état) tout en permettant un regroupement sémantique par domaine et en facilitant l'import groupé.

### 3. `assignedContributors` en relation directe sur Programs

Pour permettre au rôle `contributeur` d'accéder uniquement aux programmes qui lui sont assignés, un champ `assignedContributors` (relation `hasMany` vers `users`) est ajouté directement sur `Programs`. Les clauses `access.read` et `access.update` retournent `{ assignedContributors: { contains: user.id } }` pour ce rôle — le contributeur ne peut ni lister, ni consulter, ni modifier un programme auquel il n'est pas assigné.

**Pourquoi pas une table de jointure séparée ?**
Une relation directe suffit pour le POC. Une table de jointure apporterait plus de flexibilité (métadonnées d'assignation, historique) mais complexifie la stack sans bénéfice immédiat.

### 4. Système `versions/drafts` Payload sur Programs

Le cycle de vie éditorial des programmes est géré via le système natif `versions: { drafts: true }` de Payload. Le champ `_status` injecté par Payload est surchargé en sidebar avec un `access.update` restreint :

| Valeur `_status` | Description |
|---|---|
| `draft` | Brouillon (valeur par défaut à la création) |
| `published` | Publié (visible via l'API avec `draft: false`) |

Les droits de publication sont contraints par rôle via `access.update` sur le champ `_status` :
- `super-admin` et `administrateur-aide` : peuvent modifier `_status` (publier ou dépublier)
- `contributeur` : peut sauvegarder en brouillon, mais `_status` est en lecture seule — ne peut pas publier
- `observateur` : aucune modification

L'admin UI affiche les boutons natifs "Save Draft" et "Publish" ainsi que l'historique des versions (table `_programs_v` en base).

### 5. Visibilité des collections dans la sidebar admin

La propriété `admin.hidden` de Payload contrôle l'affichage d'une collection dans le menu de navigation, indépendamment des règles d'accès API.

Pour le rôle `contributeur`, seule la collection `Programs` est visible dans la sidebar. Les collections `Users`, `Media`, `Operators` et `Projects` sont masquées via `admin.hidden: ({ user }) => user?.role === 'contributeur'`.

| Collection | contributeur | observateur | administrateur-aide | super-admin |
|---|---|---|---|---|
| Programs | ✅ visible | ✅ visible | ✅ visible | ✅ visible |
| Users | ❌ masqué | ✅ visible | ✅ visible | ✅ visible |
| Media | ❌ masqué | ✅ visible | ✅ visible | ✅ visible |
| Operators | ❌ masqué | ✅ visible | ✅ visible | ✅ visible |
| Projects | ❌ masqué | ✅ visible | ✅ visible | ✅ visible |

**Pourquoi `admin.hidden` et non une restriction sur `access.read` ?**
`admin.hidden` est l'outil Payload dédié à la visibilité UI, orthogonal à la sécurité API. Modifier `access.read` pour cacher des collections aurait des effets de bord sur les requêtes API internes (ex. chargement des relations dans les formulaires). Pour le POC, la restriction est UI-only — les endpoints API restent accessibles aux utilisateurs authentifiés.

### 6. `_status: 'published'` pour les données seedées

Les programmes importés depuis `docs/sources/programs.json` reçoivent `_status: 'published'` car ils proviennent de données de production. Les nouveaux programmes créés dans l'admin reçoivent `_status: 'draft'` par défaut (comportement natif Payload).

---

## Conséquences

- La collection `users` expose `role`, `operator`, `region`, `team` dans l'admin Payload.
- La collection `programs` expose `_status` et `assignedContributors` en sidebar.
- Les `payload-types.ts` doivent être régénérés après toute modification de schéma : `node_modules/.bin/payload generate:types` depuis `apps/cms/`.
- Un utilisateur sans rôle (valeur par défaut : `observateur`) ne peut lire que les données, sans pouvoir les modifier.
- L'access control ne protège pas les routes API REST directement exposées hors Payload — à sécuriser si le POC évolue.
