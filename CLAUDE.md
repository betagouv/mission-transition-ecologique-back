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

**`pnpm seed`** — seed complet idempotent (upsert) : `GeographicAreasSeed` (18 régions + 101 départements) → `ProgramsSeed` (operators + programs depuis `docs/sources/programs.json`) → `ProjectsSeed` (depuis `docs/sources/projects.json`) → `UsersSeed` (utilisateurs de dev). Le store canonical est alimenté automatiquement par le hook `syncCanonicalOnPublish` quand `ProgramsSeed` écrit les dispositifs publiés (même chemin qu'en prod) : pas d'étape de seed canonical dédiée.

### Utilisateurs de dev (`pnpm seed`)

| Email | Mot de passe | Rôle |
|---|---|---|
| `super.admin@tee.test` | `super.admin@tee.test` | `super-admin` |
| `admin@tee.test` | `admin@tee.test` | `admin` |
| `createur@ademe.test` | `createur@ademe.test` | `creator` |

Les fichiers seed vivent dans `apps/cms/src/scripts/seed/` :
- `run.ts` — entrypoint `pnpm seed` (initialisation Payload + orchestration).
- `geographic-areas/` — `GeographicAreasSeed` (régions + départements, fixtures dans `fixtures.ts`).
- `programs/` — `ProgramsSeed`, `OperatorImporter`, `ProgramMapper`, `ProgramImporter`, `VariantMapper`. `ProgramMapper` écrit les dispositifs à URL valide en `_status: 'published'`, ce qui déclenche le hook `syncCanonicalOnPublish` : le store canonical est donc peuplé pendant cette étape, sans seed canonical séparé. `VariantMapper` traduit les `champs conditionnels` de la source en `variants` (régions → zones géographiques, seuils d'effectif → tailles, opérateurs nommés → relations `operators`) ; `OperatorImporter` crée aussi les opérateurs cités dans les variantes.
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
- `src/constants/` — options de select réutilisables, un fichier par jeu d'options (`themesOptions.ts`, `nafSectionsOptions.ts`, `aidTypeOptions.ts`, `companySizeOptions.ts`, `activitySectorOptions.ts`, `contactMethodOptions.ts`, `variantOptions.ts` : vocabulaire des variantes — types de condition, champs modifiables, bornes effectif)
- `src/services/workflow/` — `WorkflowTransitionPolicy` (logique de transitions, partagée client/serveur), `WorkflowActionPresenter` (mappe les transitions autorisées vers des actions explicites avec libellés contextuels : « Enregistrer le brouillon », « Demander la relecture », « Supprimer », « Demander des corrections » / « Annuler la demande de relecture » selon le rôle ; porte aussi le `placement` `bar`/`menu` et le flag `validate` ; partagé client/serveur), `WorkflowAutomation` (point d'extension phase automatisée)
- `src/services/canonical/` : adaptateur CMS et composition root vers le format pivot. `ProgramCanonicalMapper` (Payload `Program` vers `CanonicalProgramInput`, relations peuplées), `rich-text/` (port `RichTextToMarkdown` + impl Payload `PayloadRichTextToMarkdown`), `canonicalRepository.ts` et `canonicalProgramService.ts` (singletons mémoïsés qui injectent dans le service domaine `CanonicalProgramService` le repository fourni clé en main par `createCanonicalProgramRepository()` du store, plus le sink d'observabilité ; le CMS ne connaît pas la localisation de la DB canonical), `observability/` (adaptateurs du port `CanonicalEventSink` : `PayloadLoggerEventSink` ; composition root `canonicalEventSink.ts` = `RoutingCanonicalEventSink` qui route les événements par canal, point d'extension documenté pour Sentry/email/Slack). Voir ADR 0008
- `src/hooks/programs/` — `assignCreatorOnCreate`, `assignCanonicalId` (cuid2 immuable porté dans le pivot), `normalizeGeographicCoverage` (beforeValidate : normalise la couverture géographique), `trackLastModifiedBy` (capture `lastModifiedBy = req.user.id` à chaque changement, lu par la vue Versions custom), `beforeChangeWorkflow` (validation, sync `workflowStatus` ↔ `_status`, `WorkflowAutomation`), `syncCanonicalOnPublish` (afterChange : sync d'un dispositif publié vers le store canonical ; émet des événements `program_saved`/`program_dropped`/`sync_failed` via le sink, ne bloque jamais l'écriture CMS)
- `src/hooks/reviewComments/` : `assignCommentAuthor` (beforeValidate create : pose `author` depuis `req.user` sur un commentaire de relecture, avant la validation `required`, en ignorant toute valeur client ; lève `Forbidden` si pas d'utilisateur authentifié)
- `src/collections/ReviewComments.ts` : collection `review-comments` (commentaires de relecture, relation vers `programs`, masquée de la nav admin, pilotée depuis la sidebar du dispositif). Voir ADR 0010
- `src/components/programs/` — `WorkflowActionBar` (barre des actions `placement: 'bar'`, remplace les boutons natifs `PublishButton`/`SaveDraftButton`), `WorkflowEditMenuItems` (slot `editMenuItems` du menu « ⋮ » : rend les actions `placement: 'menu'`, càd « Supprimer » = transition `annule`, à côté de « Dupliquer » natif ; les items natifs « Créer un nouveau » et « Supprimer » dur sont masqués sur les programmes via `styles/dsfr-doc-controls.scss` ; le menu Payload étant rendu dans un portail au niveau `body`, le scoping se fait par `.popup__content:has(.tee-workflow-menu-item)` et non par un ancêtre de collection), `useWorkflowSubmit` (hook partagé barre + menu : calcule les actions via `WorkflowActionPresenter` et les soumet avec la bonne stratégie de validation, dont le `draft=true` natif pour les brouillons), `WorkflowHiddenControl` (composant vide enregistré sur les slots `SaveDraftButton`/`UnpublishButton` pour masquer les boutons natifs Payload doublonnés), `WorkflowStatusBadge` (statut sidebar), `WorkflowStatusCell` (badge liste), `WorkflowStatusPill` (badge statut réutilisable), `NumberedRowLabel` (label d'array auto-numéroté, `singular` passé via `clientProps`), `LinkedProjectsCounter` (champ `type: 'ui'` qui affiche en live le nombre de projets matchant les thèmes sélectionnés), `SelectAllAreasButtons` (champ `type: 'ui'` réservé aux admins : boutons de sélection groupée du champ `geographicAreas` : métropole seule, métropole + outre-mer, vider, selon la couverture régionale/départementale, en s'appuyant sur le drapeau `isOverseas` des `GeographicAreas`), `ReviewCommentsThread` (Field custom du champ `ui` `reviewComments` : rend un fil de discussion, avatars + auteur + horodatage + bulles + saisie ; lit/crée les commentaires dans la collection `review-comments` via l'API, enregistrement immédiat sans toucher au dispositif). **Variantes** (section « Conditions d'éligibilité variables », voir ADR 0011) : `VariantsSectionLabel` (titre d'accordéon en style natif Payload comme « Éligibilité », avec le seul suffixe « - facultatif » en italique atténué), `VariantsSectionIntro` (bandeau + intro), `VariantEtConnector` (pastille « ET » entre conditions), `VariantConditionReminder` / `VariantModificationReminder` (rappel « valeur générique actuelle »), `VariantRuleSummary` (encart « RÉSUMÉ DE LA RÈGLE »), `CompanySizeMultiSelect` (multiselect sur champ `json` : contourne un bug Payload de `select hasMany` imbriqué 2 niveaux d'array) ; helpers `variantFieldPath.ts`, `useGeographicAreaNames.ts`, `useOperatorNames.ts`
- `src/components/programs/versions/` — vue Versions custom du dispositif (override `admin.components.views.edit.versions`), vendorisée depuis la liste native Payload : `ProgramVersionsView` (serveur, `payload.findVersions`), `VersionsViewClient` (table cliente), `buildProgramVersionColumns` (colonnes Date / Qui / Statut depuis / Statut vers), `CreatedAtCell` (lien date vers la vue détail native = accordéon de diff)

### `libs/canonical` — `@tee-backoffice/canonical`

Format **pivot** interne (Canonical Data Model) : TypeScript pur + zod, sans dépendance framework. Source de vérité = zod, types inférés (`z.infer`), clés en français `snake_case` (= format wire). Voir ADR 0007.

**Architecture DDD / hexagonale** (voir ADR 0008 et `libs/canonical/CLAUDE.md`) : ce package est le **domaine**. Il définit les **ports** `CanonicalProgramRepository` (persistance) et `CanonicalEventSink` (observabilité), et le **service** `CanonicalProgramService` (valide puis upsert via le port). Les implémentations concrètes (store libSQL, mapper CMS, converter markdown, canaux de logs/Sentry/email) sont **injectées depuis `apps/cms`** (composition root). Les dépendances pointent toujours vers le domaine, jamais l'inverse. Interdit ici : Payload, drivers DB.

- `src/shared/` — `primitives.ts` (primitifs brandés : `Cuid2`, `Siren`, `NafCode`, dates ISO, `Intervalle`…), `cog.ts` (dictionnaire unique des niveaux COG `COG_NIVEAUX` + `CogNiveau`/`COG_PREFIXES`), `schema/` (`cog.ts` : `cogCodeSchema`/`CogCode`, garde de forme souple ; `operator.ts` : `operateurSchema`/`operateursSchema`)
- `src/canonical-program/` — `enums.ts`, `canonical-program.schema.ts` (racine, `merge` + `superRefine`), `canonical-program.types.ts` (`CanonicalProgramData`), `CanonicalProgram` (value object), `CanonicalProgramValidator` (point d'entrée de validation), `CanonicalProgramRepository` (port de persistance), `CanonicalProgramService` (service domaine : valide puis upsert via le port injecté, émet les événements `program_saved`/`program_dropped`), `fields/` (identite, contenu, aide, eligibilite), `variants/`, `additional-data/`
- `src/observability/` — port d'observabilité (canaux pluggables) : `CanonicalEvent` (union d'événements : `program_saved`, `program_dropped` avec `phase` write/read, `sync_failed`), `CanonicalEventSink` (port `emit`, fire-and-forget, ne jette jamais), `NullEventSink` (no-op par défaut), `RoutingCanonicalEventSink` (route chaque événement vers les canaux dont le filtre matche), `CompositeEventSink` (fan-out d'un événement vers plusieurs canaux, ex. email + Slack). Les adaptateurs concrets (logger, Sentry…) vivent dans `apps/cms`
- `tests/` — `unit/` (specs `*.spec.ts`) et `fixtures/` (golden fixtures `valid-minimal`, `valid-full`)
- `package.json` minimal avec `"type": "module"` : requis pour que node/`tsx` (le seed) traite les `.ts` du package comme de l'ESM. Ne pas le retirer.

### `libs/canonical-store` : `@tee-backoffice/canonical-store`

**Adaptateur infra** (libSQL/Drizzle) du port `CanonicalProgramRepository`. Base **dédiée et indépendante de Payload** (`canonical.db`, var `CANONICAL_DATABASE_URI`, défaut `file:./canonical.db`), pour que la donnée canonique survive à un changement de CMS. Ne dépend que de `libs/canonical` + un driver SQL, **jamais du CMS**.

- `src/schema.ts` (table Drizzle `canonical_programs`), `src/db.ts` (connexion `@libsql/client` + `CREATE TABLE IF NOT EXISTS`), `DrizzleCanonicalProgramRepository` (`.create(url)` async, upsert `onConflictDoUpdate`). Colonne `data` en TEXT JSON pour rester portable : migration Postgres future = changer `schema.ts` (dialecte) + `db.ts` (driver) uniquement, zéro impact domaine/CMS.
- `createCanonicalProgramRepository()` (`src/createCanonicalProgramRepository.ts`) : factory zéro-config qui résout elle-même `CANONICAL_DATABASE_URI` et retourne un repository prêt à l'emploi. Le store porte ainsi la localisation de sa DB ; le CMS ne la connaît pas. Défaut **ancré au workspace** (`libs/canonical-store/canonical.db`, la DB commitée vivant à côté du package) : résolu en remontant du CWD jusqu'au marqueur `pnpm-workspace.yaml` (et non via `import.meta.url`, que les transforms de test/bundler n'exposent pas toujours en URL `file:`), donc indépendant du répertoire de lancement (seed, dev, start). Les tests ouvrent un store `:memory:` explicite via `DrizzleCanonicalProgramRepository.create`.
- Même convention que `libs/canonical` : `package.json` `"type": "module"`, résolution par `paths` de `tsconfig.base.json`.

### `libs/format-adapters` — `@tee-backoffice/format-adapters`

Adaptateurs de **projection** par format cible (classes pures, testables) : lisent le canonical (store) et produisent un format externe. Ne dépend que de `libs/canonical`.

- `src/shared/` — helpers réutilisés par tous les formats : `ThemeMapper`, `TypeAideMapper`, `NafSectionResolver`, `RegionNameResolver`, `ExportPolicy.isPublished`, `ExportLogger`/`ConsoleExportLogger`.
- `src/tee/` — round-trip `programs.json` : `TeeImporter` (`programs.json` → pivot), `TeeExporter` (pivot → `programs.json`, self-check aller-retour).
- `src/agir/` — **triple export AGIR**. `AgirVocabulary` (chaînes AGIR centralisées), mappers `AgirSourceMapper`/`AgirStatutMapper`/`AgirEtatMapper`/`AgirTypeDispositifMapper`, filtre `AgirExportPolicy` (publié + statut exportable), exporters `AgirListeExporter` (index + 2 URLs, base URL injectée), `AgirDetailExporter` (`DetailDispositif`, proposition 1 R2DA), `AdemePivotExporter` (`AdemePivot`, proposition 2 = canonical wire + deltas ADEME, liste blanche `.strict()`). Types + garde-fous zod `agir-detail.schema.ts`/`ademe-pivot.schema.ts`. Voir `docs/context/agir-export-format.md`.
- `src/__fixtures__/canonical-programs.ts` — golden fixtures (`minimal`/`full` + `draft`/`indisponible`/`archived` pour les filtres).
- Mêmes conventions : `package.json` `"type": "module"`, résolution par `paths`.

Les **endpoints AGIR** vivent dans `apps/cms/src/endpoints/agir/agirEndpoints.ts` (publics, lecture store canonical, enregistrés via `endpoints` dans `payload.config.ts`) : ils transportent uniquement, sans logique de format. Base URL des liens dérivée de `req.origin`. 
Warning, if a reverse proxy is setup, this will need to change.

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
| `docs/adr/0008-canonical-persistence-ddd.md` | Persistance du canonical + architecture DDD/DI : canonical = source de vérité durable (anti-lock-in), store libSQL/Drizzle indépendant de Payload (`libs/canonical-store`), port `CanonicalProgramRepository` + service domaine `CanonicalProgramService`, composition root et injection dans `apps/cms`, sync au publish (hook unique, seed inclus), observabilité des drops (port `CanonicalEventSink` + canaux pluggables logger/Sentry/email/Slack, routage), migration Postgres future |
| `docs/adr/0009-programs-versions-view.md` | Sidebar et versions — masquage de `workflowHistory` de la sidebar, champ `lastModifiedBy`, vue Versions custom (Date / Qui / Statut depuis / Statut vers) vendorisée depuis la liste native |
| `docs/adr/0010-document-locking-and-review-comments.md` | Verrouillage de document (`lockDocuments` natif Payload, accès exclusif pendant l'édition) et commentaires de relecture (collection dédiée `review-comments` liée au dispositif, champ `ui` `reviewComments` en sidebar sous la description SEO rendu en fil de discussion par `ReviewCommentsThread`, enregistrement immédiat par POST sans effet workflow/version, auteur posé par `assignCommentAuthor`) |
| `docs/adr/0011-program-variants-form.md` | Formulaire des variantes (champs conditionnels) dans Payload : section `variants` (conditions taille/zone cumulées en ET + modifications), 7 champs modifiables mappés vers `varianteModificationsSchema` (montant, durée, url, opérateurs, éligibilité), composants admin custom, et **contournement d'un bug Payload** (`select hasMany` imbriqué 2 niveaux d'array → stockage `json` via `CompanySizeMultiSelect`) |

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
