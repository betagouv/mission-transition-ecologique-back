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
pnpm nx run-many -t lint                # lint tout le workspace
pnpm nx affected -t lint                # lint fichiers modifiés
```

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

## Documentation de référence

- `docs/sources/` — **NE PAS MODIFIER** — documentation brute (brainstorming produit)
- `docs/adr/` — décisions techniques (ADR)
- `docs/context/` — contexte métier consolidé (alimenté manuellement)

## Commits

Utiliser les **Conventional Commits** : `<type>(<scope>): <description>`

Types : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`
- Description en anglais, impératif, sans majuscule, sans point final
- Scope recommandé (ex: `cms`, `auth`, `api`)

Exemples : `feat(cms): add User collection` — `fix(cms): resolve SQLite index conflict`

## Architecture du code

### Principes SOLID

- **S — Single Responsibility** : une classe = une seule responsabilité. Une classe = un fichier, nommé identiquement (`ProgressBar.ts` pour `class ProgressBar`). Pas de classes secondaires dans le même fichier.
- **O — Open/Closed** : les classes sont ouvertes à l'extension (héritage, composition) mais fermées à la modification directe. Préférer étendre plutôt que modifier une classe existante.
- **L — Liskov Substitution** : une sous-classe doit pouvoir remplacer sa classe parente sans altérer le comportement attendu.
- **I — Interface Segregation** : préférer plusieurs interfaces spécifiques à une seule interface générale. Ne pas forcer une classe à implémenter des méthodes qu'elle n'utilise pas.
- **D — Dependency Inversion** : dépendre des abstractions (interfaces/types), pas des implémentations concrètes. Injecter les dépendances plutôt que les instancier en dur.

Les classes utilitaires partagées vont dans `src/utils/`.

## Règles importantes

- Ne jamais modifier les fichiers dans `docs/sources/`
- Ne pas committer sans avoir fait tourner `pnpm nx affected -t lint`
- `payload-types.ts` est généré — ne pas l'éditer manuellement
- `importMap.js` est généré — ne pas l'éditer manuellement, regénérer avec `pnpm generate:importmap` après tout ajout de composant custom Payload