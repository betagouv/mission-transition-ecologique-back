# TEE POC — Backend

Proof of concept du backend de **Transition Écologique des Entreprises (TEE)**, porté par l'ADEME / BetaGouv.

## Stack

| Outil | Rôle |
|---|---|
| [NX 22](https://nx.dev) | Monorepo — orchestration des tâches et des dépendances |
| [PayloadCMS 3](https://payloadcms.com) | CMS headless TypeScript-first, API REST + admin UI |
| [Next.js 15](https://nextjs.org) | Framework applicatif (requis par PayloadCMS v3) |
| [SQLite](https://www.sqlite.org) | Base de données (fichier local, pas de serveur) |
| [pnpm 10](https://pnpm.io) | Gestionnaire de paquets |
| Node.js v24 | Runtime |

## Structure

```
apps/
  cms/          # Application PayloadCMS (admin + API REST)
libs/           # Libs partagées entre apps
docs/
  sources/      # Documentation de référence (ne pas modifier)
  adr/          # Architecture Decision Records
  context/      # Contexte métier du POC
memory/         # Mémoire persistante Claude Code
```

## Prérequis

- Node.js v24 (via `nvm use`)
- pnpm (`npm install -g pnpm`)
- SQLite (fichier local généré automatiquement)

## Installation

```sh
nvm use
pnpm install
```

## Variables d'environnement

Copier `.env.example` en `.env` dans `apps/cms/` :

```sh
cp .env.example apps/cms/.env
```

| Variable | Description |
|---|---|
| `DATABASE_URI` | Chemin SQLite (défaut : `file:./tee-poc.db`) |
| `PAYLOAD_SECRET` | Clé secrète de chiffrement Payload |

## Commandes

```sh
# Développement
pnpm nx run @tee-backoffice/cms:dev

# Build
pnpm nx run @tee-backoffice/cms:build

# Lint
pnpm nx run-many -t lint

# Lint sur les fichiers modifiés uniquement
pnpm nx affected -t lint

# Typecheck
pnpm nx run @tee-backoffice/cms:typecheck
```

## Commits

Ce projet suit les [Conventional Commits](https://www.conventionalcommits.org) :

```
<type>(<scope>): <description>
```

Types : `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`

```sh
feat(cms): add User collection with role field
fix(cms): resolve SQLite index conflict on startup
chore: upgrade PayloadCMS to 3.80.0
```

## Documentation

- `docs/sources/` — Documentation de référence produit (brainstorming, cas d'usage, droits)
- `docs/adr/` — Décisions techniques (Architecture Decision Records)
- `docs/context/` — Contexte métier consolidé
