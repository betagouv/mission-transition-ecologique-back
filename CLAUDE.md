<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

---

# TEE POC Backend — Instructions Claude Code

## Projet

Proof of concept backend TEE (Transition Écologique des Entreprises) — ADEME / BetaGouv.
Stack : NX 22 + PayloadCMS 3 + Next.js 15 + PostgreSQL + pnpm 10 + Node.js v24.

## Commandes essentielles

```sh
pnpm nx run @tee-backoffice/cms:dev        # dev
pnpm nx run @tee-backoffice/cms:build      # build
pnpm nx run @tee-backoffice/cms:lint       # lint
pnpm nx run @tee-backoffice/cms:typecheck  # typecheck
pnpm nx run-many -t lint                   # lint tout le workspace
pnpm nx affected -t lint                   # lint fichiers modifiés
pnpm seed                                  # seed complet : operators + programs + utilisateurs de dev
```

## Seed

**`pnpm seed`** — seed complet idempotent (upsert) : `GeographicAreasSeed` (18 régions + 101 départements) → `ProgramsSeed` (operators + programs depuis `docs/sources/programs.json`) → `ProjectsSeed` (depuis `docs/sources/projects.json`) → `UsersSeed` (utilisateurs de dev).

### Utilisateurs de dev (`pnpm seed`)

| Email | Mot de passe | Rôle |
|---|---|---|
| `super.admin@tee.test` | `super.admin@tee.test` | `super-admin` |
| `admin@tee.test` | `admin@tee.test` | `admin` |
| `createur@ademe.test` | `createur@ademe.test` | `creator` |

Les fichiers seed vivent dans `apps/cms/src/scripts/seed/` :
- `run.ts` — entrypoint `pnpm seed` (initialisation Payload + orchestration).
- `geographic-areas/` — `GeographicAreasSeed` (régions + départements, fixtures dans `fixtures.ts`).
- `programs/` — `ProgramsSeed`, `OperatorImporter`, `ProgramMapper`, `ProgramImporter`.
- `projects/` — `ProjectsSeed`, `ProjectMapper`, `ProjectImporter`, `LinkedProjectsUpdater`.
- `users/` — `UsersSeed`.

## Langue

- **Documentation** (README, ADR, docs/, commentaires de PR) : **français**
- **Code** (variables, fonctions, classes, fichiers, commentaires dans le code) : **anglais**

## Conventions

- **Package manager** : toujours `pnpm`, jamais `npm` ou `yarn`
- **Node** : v24 via nvm (`.nvmrc` à la racine)
- **Nommage des packages NX** : `@tee-backoffice/<nom>`
- **Apps** dans `apps/`, libs partagées dans `libs/`
- **ESLint** : flat config ESLint 9 — `typescript-eslint` strict + `next/core-web-vitals` sur l'app CMS
- **TypeScript** : strict mode activé, pas de `any` explicite (warning)
- **Imports de types** : utiliser `import type` systématiquement

## Structure des apps

### `apps/cms` — PayloadCMS

- `payload.config.ts` — config principale (collections, DB, editor)
- `src/app/(payload)/admin/` — routes UI admin PayloadCMS
- `src/app/(payload)/api/[...slug]/` — routes REST API PayloadCMS
- `payload-types.ts` — généré automatiquement par Payload, **ne pas modifier à la main**
- `src/utils/user/UserRole.ts` — classe `UserRole` (constantes, hiérarchie, méthodes `isSuperAdmin` / `isAdmin` / `isCreator`) + type `UserRoleValue`
- `src/constants/` — options de select réutilisables, un fichier par jeu d'options (`themesOptions.ts`, `nafSectionsOptions.ts`, `aidTypeOptions.ts`, `companySizeOptions.ts`, `activitySectorOptions.ts`, `contactMethodOptions.ts`)
- `src/services/workflow/` — `WorkflowTransitionPolicy` (logique de transitions, partagée client/serveur), `WorkflowAutomation` (point d'extension phase automatisée)
- `src/hooks/programs/` — `beforeChangeWorkflow` (validation, sync `workflowStatus` ↔ `_status`, intégration `WorkflowAutomation`), `assignCreatorOnCreate`, `trackLastModifiedBy` (capture `lastModifiedBy = req.user.id` à chaque changement, lu par la vue Versions custom)
- `src/components/programs/` — `WorkflowActionBar` (bouton contextuel), `WorkflowStatusBadge` (statut sidebar), `WorkflowStatusCell` (badge liste), `WorkflowStatusPill` (badge statut réutilisable), `NumberedRowLabel` (label d'array auto-numéroté, `singular` passé via `clientProps`), `LinkedProjectsCounter` (champ `type: 'ui'` qui affiche en live le nombre de projets matchant les thèmes sélectionnés)
- `src/components/programs/versions/` — vue Versions custom du dispositif (override `admin.components.views.edit.versions`), vendorisée depuis la liste native Payload : `ProgramVersionsView` (serveur, `payload.findVersions`), `VersionsViewClient` (table cliente), `buildProgramVersionColumns` (colonnes Date / Qui / Statut depuis / Statut vers), `CreatedAtCell` (lien date vers la vue détail native = accordéon de diff)

### `libs/canonical` — `@tee-backoffice/canonical`

Format **pivot** interne (Canonical Data Model) : TypeScript pur + zod, sans dépendance framework. Source de vérité = zod, types inférés (`z.infer`), clés en français `snake_case` (= format wire). Voir ADR 0007.

- `src/shared/` — `primitives.ts` (primitifs brandés : `Cuid2`, `Siren`, `NafCode`, dates ISO, `Intervalle`…), `cog.ts` (dictionnaire unique des niveaux COG `COG_NIVEAUX` + `CogNiveau`/`COG_PREFIXES`), `schema/` (`cog.ts` : `cogCodeSchema`/`CogCode`, garde de forme souple ; `operator.ts` : `operateurSchema`/`operateursSchema`)
- `src/canonical-program/` — `enums.ts`, `canonical-program.schema.ts` (racine, `merge` + `superRefine`), `canonical-program.types.ts` (`CanonicalProgramData`), `CanonicalProgram` (value object), `CanonicalProgramValidator` (point d'entrée de validation), `fields/` (identite, contenu, aide, eligibilite), `variants/`, `additional-data/`
- `tests/` — `unit/` (specs `*.spec.ts`) et `fixtures/` (golden fixtures `valid-minimal`, `valid-full`)

## Documentation de référence

- `docs/sources/` — **NE PAS MODIFIER** — documentation brute (brainstorming produit)
- `docs/adr/` — décisions techniques (ADR) — voir index ci-dessous
- `docs/context/` — contexte métier consolidé (alimenté manuellement)

### Index des ADR

Ne lire un ADR que s'il est pertinent pour la tâche en cours.

| Fichier | Thématique |
|---|---|
| `docs/adr/0001-programs-collection.md` | ⚠️ Schéma initial — voir ADR 0006 pour le schéma actuel. Reste valide pour : exclusion de `publicodes`, deux collections `Programs` + `Operators`, type `date` natif, illustration en chemin texte |
| `docs/adr/0002-user-roles-and-access-control.md` | Rôles utilisateurs, hiérarchie des rôles, `UserRole`, access control (`AuthAccessPolicy`, `ProgramAccessPolicy`, `OperatorAccessPolicy`) |
| `docs/adr/0003-projects-collection.md` | Schéma de la collection `Projects` — thèmes, secteurs NAF, liaisons entre projets |
| `docs/adr/0004-programs-workflow.md` | ⚠️ Obsolète — superseded par ADR 0005 |
| `docs/adr/0005-programs-workflow-extended.md` | Workflow éditorial des programmes — 9 états, 3 rôles, `WorkflowTransitionPolicy`, `WorkflowAutomation`, `replacedBy` |
| `docs/adr/0006-programs-form-refactor.md` | Refonte du formulaire `Programs` — sections collapsibles, conditionnels par `aidType`, suppression du double modèle d'éligibilité, collection `GeographicAreas`, composants admin custom |
| `docs/adr/0007-canonical-pivot-format.md` | Format pivot interne (`libs/canonical`) — Canonical Data Model, zod source de vérité, clés `snake_case`, primitifs brandés, éligibilité refacto (`texte`/`structure` par critère), `CanonicalProgram` + `CanonicalProgramValidator`. Référence champs : `docs/context/canonical-pivot-format.md` |
| `docs/adr/0008-programs-versions-view.md` | Sidebar et versions — masquage de `workflowHistory` de la sidebar, champ `lastModifiedBy`, vue Versions custom (Date / Qui / Statut depuis / Statut vers) vendorisée depuis la liste native |

## Commits

Utiliser les **Conventional Commits** : `<type>(<scope>): <description>`

Types : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`
- Description en anglais, impératif, sans majuscule, sans point final
- Scope recommandé (ex: `cms`, `auth`, `api`)

Exemples : `feat(cms): add User collection` — `fix(cms): resolve SQLite index conflict`

## Architecture du code

### Style de code : OOP / Classes

**Toujours préférer le style orienté objet avec des classes** pour la logique métier, les services, les utilitaires et les scripts.

- Encapsuler la logique dans des classes, pas dans des fonctions standalone ou des modules fonctionnels
- Utiliser des interfaces/types TypeScript pour définir les contrats entre classes
- Les fonctions pures et les helpers simples restent acceptables pour les transformations de données triviales (ex: mappers inline dans un constructeur)

### Principes SOLID

- **S — Single Responsibility** : une classe = une seule responsabilité. Une classe = un fichier, nommé identiquement (`ProgressBar.ts` pour `class ProgressBar`). Pas de classes secondaires dans le même fichier.
- **O — Open/Closed** : les classes sont ouvertes à l'extension (héritage, composition) mais fermées à la modification directe. Préférer étendre plutôt que modifier une classe existante.
- **L — Liskov Substitution** : une sous-classe doit pouvoir remplacer sa classe parente sans altérer le comportement attendu.
- **I — Interface Segregation** : préférer plusieurs interfaces spécifiques à une seule interface générale. Ne pas forcer une classe à implémenter des méthodes qu'elle n'utilise pas.
- **D — Dependency Inversion** : dépendre des abstractions (interfaces/types), pas des implémentations concrètes. Injecter les dépendances plutôt que les instancier en dur.

Les classes utilitaires partagées vont dans `src/utils/`.

## Règles d'équipe

> Conventions de commentaires : voir `.claude/rules/code-comments.md` (rule auto-appliquée sur tout fichier `.ts`/`.tsx`).

## Règles importantes

- Ne jamais modifier les fichiers dans `docs/sources/`
- Ne pas committer sans avoir fait tourner `pnpm nx affected -t lint`
- `payload-types.ts` est généré — ne pas l'éditer manuellement
- `importMap.js` est généré — ne pas l'éditer manuellement, regénérer avec `pnpm generate:importmap` après tout ajout de composant custom Payload
- **Toujours vérifier que la documentation est à jour avec le code** : après tout changement structurel (renommage/déplacement de fichiers ou dossiers, ajout/suppression de collections, modification d'architecture), mettre à jour les sections concernées dans `CLAUDE.md` (ex: Seed, Structure des apps), les ADR dans `docs/adr/`, les fichiers de contexte dans `docs/context/`, et les fiches de feature dans `docs/features/` (tableaux de fichiers, étapes d'implémentation)
