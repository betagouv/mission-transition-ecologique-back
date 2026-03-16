Tu es le coordinateur d'une équipe d'agents IA chargée d'implémenter une feature. L'argument fourni est le numéro de la feature (ex: `001`).

Lis le fichier `docs/features/` dont le nom commence par `$ARGUMENTS`. Ce fichier est la source de vérité pour toute l'exécution.

Mets à jour le statut dans `docs/features/TASKS.md` → `in-progress` avant de commencer.

---

## Agents de développement

Lance un agent par étape d'implémentation décrite dans le fichier de feature.

**Règles :**
- Les étapes sans dépendances peuvent être lancées en parallèle
- Chaque agent reçoit : le fichier de feature complet + le contenu des fichiers existants qu'il doit modifier
- Chaque agent respecte les conventions CLAUDE.md (nommage, SOLID, `import type`, pas de `any`)
- Les fichiers générés ne doivent pas modifier `payload-types.ts` ni `importMap.js`

**Ordre recommandé :**
1. Types (`types.ts`) — pas de dépendances
2. Collection Payload (`collections/*.ts`) — pas de dépendances
3. Mapper (`*Mapper.ts`) — dépend des types
4. Importer (`*Importer.ts`) — dépend du Mapper
5. Classes auxiliaires (ex: `*Updater.ts`) — dépend des types
6. Entry point seed (`index.ts`) — dépend de tout ce qui précède
7. Modifications de fichiers existants (`run.ts`, `payload.config.ts`) — en dernier

---

## Agents de qualité

Une fois tous les agents de développement terminés, lance les vérifications **séquentiellement** :

### Agent Lint
```sh
PATH="~/.nvm/versions/node/v24.13.0/bin:$PATH" node node_modules/nx/bin/nx.js affected -t lint
```
Si des erreurs sont détectées : corrige-les avant de passer à l'étape suivante.

### Agent Typecheck
```sh
PATH="~/.nvm/versions/node/v24.13.0/bin:$PATH" node_modules/.bin/tsc --noEmit -p apps/cms/tsconfig.json
```
Si des erreurs sont détectées : corrige-les avant de passer à l'étape suivante.

### Agent Build
```sh
PATH="~/.nvm/versions/node/v24.13.0/bin:$PATH" node node_modules/nx/bin/nx.js run @tee-backoffice/cms:build
```
Si le build échoue : analyse les erreurs et corrige.

---

## Agents de documentation

Une fois la qualité validée :

### Agent TASKS
Met à jour `docs/features/TASKS.md` : statut → `done`, ajoute la date de complétion.

### Agent Context
Si la feature introduit un nouveau modèle de données ou modifie un modèle existant, crée ou met à jour le fichier correspondant dans `docs/context/`.

### Agent ADR
Pour chaque ADR référencé dans le fichier de feature (`docs/adr/`) :
- Si l'ADR **existe déjà** : vérifie que les décisions implémentées correspondent à ce qui est documenté. Si l'implémentation a divergé (ajustement technique, contrainte découverte en cours de route), mets à jour l'ADR pour refléter la réalité — ajoute une note de révision avec la date et la raison du changement.
- Si l'ADR **n'existe pas encore** : crée-le au format standard du projet (voir `docs/adr/0001-programs-collection.md`) en documentant les décisions effectivement prises lors de l'implémentation.

---

## Résultat attendu

Affiche un récapitulatif :
- Fichiers créés / modifiés (liste)
- Résultats des vérifications (lint / typecheck / build : ✓ ou ✗)
- Statut final de la feature dans TASKS.md
