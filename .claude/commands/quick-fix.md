Tu es le coordinateur d'une équipe d'agents IA chargée de planifier et exécuter un correctif ciblé.

`$ARGUMENTS` est une description libre du problème ou du correctif à apporter (ex: `le champ slug n'est pas validé à l'unicité`).

> ⚠️ Cette commande ne crée pas de fichier de feature ni d'ADR. Elle met à jour la documentation existante uniquement après validation finale (`approve`).

---

## PHASE 1 — Planification

### Étape 0 — Lecture du contexte

Lis les fichiers suivants avant tout :
- `CLAUDE.md` — conventions et structure du projet
- `docs/adr/` — décisions déjà prises (pour identifier celles potentiellement impactées)
- `docs/context/` — modèles existants (pour identifier ceux potentiellement impactés)

---

### Étape 1 — Agent PO (clarification)

**Rôle :** S'assurer de la bonne compréhension du problème avant toute rédaction.

En te basant sur `$ARGUMENTS` et le contexte projet, identifie les zones d'ambiguïté. Pose les questions nécessaires — ne suppose rien de non évident.

Questions typiques à envisager :
- Est-ce un bug constaté en production / dev, ou une régression ?
- Quel est le comportement actuel vs le comportement attendu ?
- Y a-t-il des cas limites ou des scénarios edge à couvrir ?
- Le fix doit-il rester rétrocompatible avec des données existantes ?

Si la description est claire et sans ambiguïté, tu peux passer directement à l'étape suivante sans poser de questions — indique simplement que tu as bien compris le besoin.

**Attends les réponses de l'utilisateur si des questions ont été posées.**

---

### Étape 2 — Agent Lead Tech

**Rôle :** Définir précisément ce qu'il faut modifier et comment.

En s'appuyant sur les réponses du PO :
- Identifier les fichiers à modifier (tableau `Fichier | Modification à apporter`)
- Décrire les changements avec suffisamment de précision pour une exécution sans ambiguïté
- Identifier les risques de régression ou les points d'attention TypeScript / Payload / NX
- Identifier les documents existants potentiellement impactés : ADR (`docs/adr/`), modèles (`docs/context/`), `CLAUDE.md`

Si des choix techniques sont non triviaux, pose des questions à l'utilisateur avant de trancher.

**Attends la validation de l'utilisateur si des questions ont été posées.**

---

### Étape 3 — Récapitulatif et validation du plan

Présente un récapitulatif structuré :

```
## Récapitulatif du fix

**Problème :** <description concise>

**Fichiers à modifier :**
| Fichier | Modification |
|---------|-------------|
| ...     | ...         |

**Documentation à mettre à jour après validation :**
| Document | Mise à jour nécessaire |
|----------|----------------------|
| ...      | ...                  |
(ou "Aucune")

**Points d'attention :** <risques, régressions potentielles>
```

Puis affiche le sélecteur suivant et **attends la réponse** :

> **Que souhaites-tu faire ?**
> `1` — Le plan est bon, lancer l'exécution
> `2` — Donner plus de contexte ou ajuster le plan

- Si `1` → passe à la Phase 2
- Si `2` → l'utilisateur saisit librement des précisions ou corrections ; reprends en **Phase 1 — Étape 1** en intégrant ces nouvelles informations, puis représente le récapitulatif

---

## PHASE 2 — Exécution

> Cette phase démarre uniquement après réception de `1`.

### Contexte compacté pour l'exécution

Avant de lancer les agents, construis un bloc de contexte minimal contenant :
- La description du problème
- La liste des fichiers à modifier avec les changements attendus
- La liste des documents à mettre à jour
- Les conventions essentielles (issues de `CLAUDE.md`)

Ce bloc sert de source de vérité pour tous les agents d'exécution.

---

### Agents de développement

Lance un agent par fichier à modifier. Les modifications sans dépendances peuvent être lancées en parallèle.

**Règles :**
- Chaque agent reçoit : le bloc de contexte compacté + le contenu du fichier à modifier
- Chaque agent respecte les conventions CLAUDE.md (nommage, SOLID, `import type`, pas de `any`)
- Ne pas modifier `payload-types.ts` ni `importMap.js`

---

### Agents de qualité (séquentiels)

#### Agent Lint
```sh
PATH="/home/yohann/.nvm/versions/node/v24.13.0/bin:/usr/bin:/bin:$PATH" node node_modules/nx/bin/nx.js affected -t lint
```
Si des erreurs : corrige avant de continuer.

#### Agent Typecheck
```sh
PATH="/home/yohann/.nvm/versions/node/v24.13.0/bin:/usr/bin:/bin:$PATH" node_modules/.bin/tsc --noEmit -p apps/cms/tsconfig.json
```
Si des erreurs : corrige avant de continuer.

---

### Résultat de l'exécution

Affiche un résumé :
- Fichiers modifiés (liste)
- Résultats des vérifications (lint / typecheck : ✓ ou ✗)

Puis affiche le sélecteur suivant et **attends la réponse** :

> 🧪 Fix appliqué — teste dans le navigateur.
>
> **Que souhaites-tu faire ?**
> `approve` — Le comportement est correct, finaliser la documentation
> `2` — Décrire ce qui ne va pas pour relancer un cycle

- Si `approve` → passe à la Phase 3
- Si `2` → l'utilisateur décrit le problème observé ; reprends en **Phase 1 — Étape 1** en tenant compte des modifications déjà effectuées et du nouveau retour, puis enchaîne Phase 1 → Phase 2

---

## PHASE 3 — Documentation (après `approve`)

> Cette phase démarre uniquement après réception de `approve`.

### Agent Documentation

Met à jour uniquement les documents identifiés au récapitulatif :
- **ADR impacté** : ajoute une note de révision (date + raison du changement) dans la section concernée
- **Modèle `docs/context/`** : corrige la description ou le schéma pour refléter l'état réel
- **`CLAUDE.md`** : met à jour si une convention ou une structure a changé

Ne crée aucun nouveau document (ni ADR, ni fichier de feature).

Affiche en fin :
- Documents mis à jour (ou "Aucun")
