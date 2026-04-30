# ADR 0005 — Workflow des programmes — états étendus

**Date :** 2026-04-30
**Feature :** [003-programs-workflow-extended](../features/003-programs-workflow-extended.md)
**Statut :** Accepté
**Décideurs :** PO, Tech Lead
**Supersede :** [ADR 0004 — Workflow de validation des programmes](0004-programs-workflow.md)

---

## Contexte

L'ADR 0004 a introduit un workflow à 4 états (`brouillon`, `en-revision`, `valide`, `publie`) avec 4 rôles utilisateurs (`super-admin`, `administrateur-aide`, `contributeur`, `observateur`).

Le diagramme produit cible (`docs/sources/workflow-programs.png`, voir aussi [issue #2604](https://github.com/betagouv/mission-transition-ecologique/issues/2604)) introduit :

- 9 états plus représentatifs du cycle de vie réel d'un dispositif (création, relecture, publication automatisée, modification d'un publié, archivage, remplacement, annulation, import).
- 2 acteurs principaux (`Créateur de dispositif`, `Admin`) au lieu de 4 rôles, avec une zone "Automatisé" pour les traitements post-publication.
- Une boucle de modification (`Publié → En cours de modification → En relecture → … → Publié`) qui exploite les versions Payload.

Cet ADR remplace l'ADR 0004. Aucune migration de données n'est nécessaire : la base sera reset, le seed recréera les programmes en état `publie`.

---

## Décisions

### 1. Refonte des rôles utilisateurs

**Décision :** Réduire la matrice de rôles à trois valeurs :

| Rôle | Slug | Droits POC |
|------|------|-----------|
| Super Admin | `super-admin` | Tous les droits, peut effectuer toute transition |
| Admin | `admin` | Mêmes droits que `super-admin` pour le POC, distinction conservée pour évolutions futures |
| Créateur | `creator` | Crée et soumet à relecture des programmes auxquels il est rattaché |

Mapping depuis l'ancien :

| Avant (ADR 0002 / 0004) | Après |
|---|---|
| `contributeur` | `creator` |
| `administrateur-aide` | `admin` |
| `super-admin` | `super-admin` (inchangé) |
| `observateur` | _supprimé_ |

**Alternatives considérées :**
- Conserver les 4 rôles existants : ne reflète pas le découpage du diagramme (créateur / admin / système).
- Distinguer dès le POC `admin` et `super-admin` par les droits : prématuré tant que le besoin métier n'est pas formalisé.

**Justification :**
Le diagramme produit ne distingue que deux acteurs humains (Créateur / Admin). Le `super-admin` est conservé comme rôle de "secours" (override universel). La parité actuelle des droits Admin / Super Admin permet de refactorer plus tard sans casser les utilisations courantes.

---

### 2. États étendus du workflow

**Décision :** Le champ `workflowStatus` accepte désormais 9 valeurs :

| Slug | Libellé | Notes |
|------|---------|-------|
| `en-creation` | En création | Default à la création |
| `en-relecture` | En relecture | Soumis à validation admin |
| `en-cours-publication` | En cours de publication | Phase automatisée — instantanée pour le POC |
| `publie` | Publié | Visible publiquement (`_status: published`) |
| `en-cours-modification` | En cours de modification | Édition d'un programme déjà publié (nouvelle version draft) |
| `importe` | Importé | Créé via flux d'import (UI/script à venir) |
| `annule` | Annulé | Final |
| `archive` | Archivé | Final pour le POC |
| `remplace` | Remplacé | Final, requiert `replacedBy` |

**Justification :**
Représente fidèlement le cycle métier. Les états finaux (`annule`, `archive`, `remplace`) sont identifiés explicitement pour permettre les filtres (`filterOptions` sur `replacedBy`) et la cohérence de l'UI.

---

### 3. Matrice des transitions

**Décision :** La matrice est centralisée dans `WorkflowTransitionPolicy` et reste sans dépendance serveur (utilisée client + serveur).

| De | Vers | Rôles |
|----|------|-------|
| `en-creation` | `en-relecture`, `annule` | créateur, admin, super-admin |
| `en-relecture` | `en-cours-publication`, `annule` | admin, super-admin |
| `en-relecture` | `en-cours-modification` | créateur, admin, super-admin (souvent implicite via "Enregistrer le brouillon") |
| `en-cours-publication` | `publie` (auto), `annule` | système (auto) / admin (annuler) |
| `publie` | `en-cours-modification`, `archive`, `remplace` | admin, super-admin |
| `en-cours-modification` | `en-relecture` | créateur, admin, super-admin |
| `en-cours-modification` | `en-cours-publication` | admin, super-admin |
| `importe` | `en-relecture` | admin, super-admin |
| États finaux (`annule`, `archive`, `remplace`) | _aucune_ | — |

`super-admin` peut effectuer toute transition (override).

**Alternatives considérées :**
- Permettre la restauration depuis `annule` ou `archive` : reportée — cas d'usage non confirmé pour le POC.
- Permettre au `createur` de modifier un publié : exclu — c'est une responsabilité éditoriale (admin).

---

### 4. Phase automatisée `en-cours-publication → publie`

**Décision :** La transition vers `en-cours-publication` déclenche immédiatement, dans la même requête HTTP, un appel à `WorkflowAutomation.runPublishingPipeline()`. Pour le POC, cette méthode retourne directement `'publie'`. Le hook serveur applique alors `data.workflowStatus = 'publie'` avant de persister.

Le service `WorkflowAutomation` (`apps/cms/src/services/workflow/WorkflowAutomation.ts`) constitue le **point d'extension unique** pour les futurs traitements automatiques :
- envoi d'un mailing de publication ;
- attente que `validityStart <= today` avant de basculer sur `publie` (renvoyer `null` pour persister `en-cours-publication`) ;
- toute autre tâche post-publication.

**Alternatives considérées :**
- Persister `en-cours-publication` puis utiliser un Payload Job pour la transition vers `publie` : plus fidèle au diagramme mais lourd à mettre en place tant que les traitements automatiques ne sont pas spécifiés.
- Effectuer le traitement directement dans le hook (sans classe dédiée) : empêche la testabilité unitaire et fait grossir le hook au fur et à mesure des extensions.

**Justification :**
La transition instantanée préserve la simplicité de l'UI (l'utilisateur clique "Publier", voit "Publié" sur la page suivante). Le service `WorkflowAutomation` isole le code à étendre — la transition vers un job asynchrone ne touchera pas le hook lui-même.

---

### 5. Gestion de `Modifier` depuis `Publié` via les versions Payload

**Décision :** Deux portes d'entrée vers `en-cours-modification` :

1. **Explicite** — depuis `publie`, l'admin sélectionne "Modifier" dans le `WorkflowActionBar`. Le hook applique la transition `publie → en-cours-modification` et bascule `_status` en `draft`.
2. **Implicite (Save Draft)** — depuis `publie` _ou_ `en-relecture`, l'utilisateur (créateur ou admin) modifie le formulaire et clique "Enregistrer le brouillon" (bouton natif Payload). Le hook détecte `previousStatus ∈ { 'publie', 'en-relecture' }` + `data._status === 'draft'` et force `workflowStatus = 'en-cours-modification'` avant la persistance. Cela évite à l'utilisateur d'avoir à choisir explicitement la transition pour entrer dans le mode "édition" — qu'il s'agisse de retirer un programme de la file de relecture pour l'amender, ou d'éditer un publié.

Dans les deux cas, grâce au système natif Payload `versions: { drafts: true }` (déjà configuré sur la collection), la version `published` précédente reste accessible via l'API publique (`GET /api/programs?draft=false`) jusqu'à ce que la nouvelle version soit re-publiée.

Depuis `en-cours-modification`, l'admin peut soit "Demander la relecture" (`en-relecture`), soit "Publier" directement (`en-cours-publication`).

**Alternatives considérées :**
- Cloner le document dans un nouveau document : casse les références (relations, assignedContributors, slug unique).
- Conserver l'ancien document `publie` figé et créer un nouveau document : surcharge inutile, complique le suivi de l'historique.

**Justification :**
Tirer parti du système de versions Payload est l'approche la moins invasive. Le snapshot publié reste accessible sans logique custom.

---

### 6. État `remplace` et champ `replacedBy`

**Décision :** Ajout d'un champ `replacedBy` (relation `programs`, optionnel, `hasMany: false`) sur la collection `Programs`. Le hook `beforeChangeWorkflow` exige une valeur non vide pour autoriser la transition vers `remplace`. Le champ est filtré pour exclure le programme courant et les programmes en état final.

Le programme remplaçant peut être en n'importe quel état non final (ex: `en-creation`, `en-relecture`, `publie`).

**Alternatives considérées :**
- Stocker un id texte libre : moins robuste, pas de jointure native côté API.
- Exiger que le programme remplaçant soit déjà `publie` : trop strict, le diagramme prévoit une activation différée (date de fin du remplacé / publication du remplaçant).

**Justification :**
Une relation Payload native permet de filtrer/joindre côté API. La validation de l'état du remplaçant à la transition reste minimale au POC ; un mécanisme automatique sera ajouté ultérieurement (cf. ADR à venir).

---

### 7. Pas de migration des données existantes

**Décision :** La base sera reset. Le seed (`pnpm seed`) recréera les programmes directement avec `workflowStatus: 'publie'` et `_status: 'published'`. Le mapping ancien → nouveau (`brouillon → en-creation`, `en-revision → en-relecture`, `valide → ???`, `publie → publie`) n'est donc pas implémenté.

**Justification :**
Le projet est encore au stade POC, sans données de production à préserver. Une migration coûterait plus que le re-seed.

**Conséquence :**
La feature inclut explicitement l'instruction de supprimer le fichier de DB SQLite avant le re-seed.

---

### 8. ADR 0004 marquée obsolète, ADR 0002 mise à jour

**Décision :** L'ADR 0004 reçoit en tête un bandeau `Statut: Obsolète — voir ADR 0005`. L'ADR 0002 (rôles et access control) est mise à jour pour refléter les nouveaux rôles, avec un lien vers cet ADR.

**Justification :**
Conserver la trace de l'ADR 0004 est utile pour comprendre l'historique des choix. Le lien vers l'ADR 0005 évite que des futurs lecteurs partent du modèle obsolète.

---

## Conséquences

- Le schéma de la table `programs` change (nouvelles valeurs d'enum sur `workflowStatus`, nouveau champ `replacedBy`). La DB doit être reset (`rm apps/cms/data/payload.db` puis `pnpm seed`).
- `payload-types.ts` doit être régénéré : `pnpm nx run @tee-backoffice/cms:generate:types`.
- `importMap.js` doit être régénéré : `pnpm nx run @tee-backoffice/cms:generate:importmap`.
- Les utilisateurs de dev seedés changent : `super.admin@tee.test`, `admin@tee.test`, `createur@tee.test` (suppression d'`observateur@tee.test`, `admin.aide@tee.test`, `contributeur@tee.test`).
- L'access policy `ProgramAccessPolicy` est conservée mais ses appels passent par `UserRole.isAdmin` / `UserRole.isCreator`.
- Le composant `WorkflowActionBar` ouvre désormais un `window.prompt` simple pour la transition `remplace`. Une UX plus fine (modal + relation picker Payload) est laissée à une feature future.
- La phase automatisée n'a pas d'effet observable au POC (transition instantanée). Toute future tâche post-publication (mailing, attente date) doit s'ajouter dans `WorkflowAutomation.runPublishingPipeline()` — point d'extension unique.
