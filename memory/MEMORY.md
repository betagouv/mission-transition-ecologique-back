# TEE POC Backend — Mémoire Claude Code

## Règles absolues
- **JAMAIS modifier `docs/sources/`** — documentation brute de référence, intouchable
- Ne pas éditer `payload-types.ts` à la main (fichier généré par PayloadCMS)

## Langue
- **Documentation** (README, ADR, docs/, commentaires de PR) : français
- **Code** (variables, fonctions, classes, fichiers, commentaires inline) : anglais

## Stack
- NX 22 + PayloadCMS 3 + Next.js 15 + SQLite (POC)
- pnpm 10, Node.js v24 (nvm)
- ESLint 9 flat config, TypeScript strict

## Nommage
- Packages NX : `@tee-backoffice/<nom>`
- Apps dans `apps/`, libs partagées dans `libs/`

## Commandes
- Dev : `pnpm nx run @tee-backoffice/cms:dev`
- Lint : `pnpm nx run-many -t lint` ou `pnpm nx affected -t lint`
- Typecheck : `pnpm nx run @tee-backoffice/cms:typecheck`

## Commits
- Convention : **Conventional Commits** — `<type>(<scope>): <description>`
- Types : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`
- Description en anglais, impératif, sans majuscule, sans point final
- Scope recommandé : `cms`, `auth`, `api`, etc.

## Fichiers clés
- `apps/cms/payload.config.ts` — config PayloadCMS
- `eslint.config.mjs` — config ESLint racine (flat config)
- `apps/cms/eslint.config.mjs` — config ESLint CMS (+ next/core-web-vitals sur src/)
- `docs/sources/` — NE PAS TOUCHER