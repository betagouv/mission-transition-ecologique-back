---
name: worktree-init
description: >
  Crée un git worktree isolé du projet TEE POC Backoffice avec initialisation
  complète (copie de apps/cms/.env, pnpm install, pnpm generate, pnpm seed,
  attribution d'un port de dev libre).
  Use when the user says "create a worktree", "worktree init", "new worktree",
  "crée un worktree", "nouvelle branche de travail", "init worktree",
  or any variant asking to set up an isolated working copy of the project.
---

## Objectif

Créer un git worktree dans `../{project-name}-{branch-slug}` et l'initialiser
complètement pour qu'il soit prêt à développer immédiatement (dépendances,
artefacts Payload générés, base SQLite seedée, port de dev propre).

## Paramètre requis

- **input** : identifiant libre — un sujet en langage naturel (`refonte du
  formulaire operateur`), un type + sujet (`fix badge workflow`), ou un nom de
  branche déjà formaté (`feat/operator-form`).

## Étape 0 — Résolution du nom de branche (IA)

**Avant** d'appeler le script, déterminer le nom de branche définitif selon les
conventions du projet (Conventional Commits, voir `CLAUDE.md`) :

1. Choisir le préfixe git conventionnel selon le contexte :
   - `feat/` pour une nouvelle fonctionnalité
   - `fix/` si l'input contient fix, bug, correction, hotfix
   - `chore/` si l'input contient chore, refacto, cleanup, config
   - `docs/` si l'input concerne uniquement de la documentation
2. Slugifier le sujet en anglais (le code et les branches sont en anglais) :
   espaces → tirets, minuscules, sans accents.
3. Construire : `{prefix}/{slug}` — **le nom complet (préfixe inclus) doit faire
   40 caractères maximum**. Si trop long, raccourcir le slug sur une frontière
   de mot ou via une formule plus courte. Ne jamais finir par un tiret.
4. Annoncer la résolution avant de lancer le script :
   `"fix badge workflow" → fix/workflow-status-badge` (24 chars)

Si un nom de branche complet est fourni en input, l'utiliser tel quel (après
validation des 40 caractères).

**Contrainte sur le dossier worktree** : le script produit
`{project-name}-{branch-slug}` où `branch-slug` est le nom de branche avec `/`
remplacé par `-` (ex: `TEE-POC-Backoffice-fix-workflow-status-badge`).

## Exécution

```bash
.claude/skills/worktree-init/worktree-init.sh <branch-name-résolu>
# Option : sauter le seed (base vide, init plus rapide)
.claude/skills/worktree-init/worktree-init.sh <branch-name-résolu> --no-seed
```

Le `<branch-name-résolu>` peut contenir `/` (ex: `feat/operator-form`) — le
script remplace automatiquement `/` par `-` pour nommer le dossier worktree.

Le script effectue dans l'ordre — **toutes les étapes sont obligatoires** (les
artefacts Payload et la base SQLite sont gitignorés et absents du worktree sans
génération/seed explicites) :

1. `git worktree add` (crée la branche si elle n'existe pas)
2. Copie des fichiers gitignored essentiels : `.env` (racine, si présent) et
   `apps/cms/.env`. Les bases `tee-*.db` ne sont **pas** copiées : chaque
   worktree obtient une base SQLite fraîche, seedée à l'étape 5.
3. `pnpm install` — **obligatoire** (node_modules absent)
4. `pnpm generate` — **obligatoire** : régénère `apps/cms/payload-types.ts` et
   `importMap.js`, tous deux gitignorés donc absents du worktree
5. `pnpm seed` — **obligatoire par défaut** (base SQLite vide au départ) ;
   sautée avec `--no-seed`. Peuple opérateurs, programmes, projets, zones
   géographiques et utilisateurs de dev (`super.admin@tee.test`, etc.)
6. Attribution d'un **port de dev libre** (premier port ≥ 3001 non occupé / non
   réservé par un autre worktree), écrit dans `apps/cms/.env.local` (`PORT`) et
   surfacé dans la commande de dev finale. Next.js ne lit pas `PORT` depuis
   `.env` pour `next dev`, d'où le passage explicite de `--port`.

Si le script échoue en cours de route (ex: PATH manquant), reprendre **toutes
les étapes restantes** manuellement — ne pas sauter `pnpm generate` ni le seed.

## Après exécution

Indiquer à l'utilisateur la commande prête à l'emploi (port propre au worktree) :

```
cd ../{project-name}-{branch-slug}
pnpm nx run @tee-backoffice/cms:dev -- --turbopack --port {DEV_PORT}
```

## Nettoyage d'un worktree

Pour supprimer un worktree plus tard :

```bash
git worktree remove ../{project-name}-{branch-slug}
# ou si la branche n'est plus utile :
git worktree remove ../{project-name}-{branch-slug} && git branch -d {branch-name}
```
