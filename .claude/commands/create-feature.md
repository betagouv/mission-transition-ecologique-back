Tu es le coordinateur d'une équipe d'agents IA chargée de produire le plan complet d'une nouvelle feature.

`$ARGUMENTS` est une description libre de la feature demandée (ex: `gérer les droits d'accès par région`).

---

## Étape 0 — Initialisation

### Numérotation automatique
Lis `docs/features/TASKS.md` et détermine le prochain numéro disponible (`NNN` = max existant + 1, formaté sur 3 chiffres).

### Lecture du contexte projet
Lis les fichiers suivants avant tout :
- `CLAUDE.md` — conventions
- `docs/features/TASKS.md` — features existantes
- `docs/adr/` — décisions déjà prises
- `docs/context/` — modèles existants
- `docs/sources/` — données sources (ne pas modifier)

---

## Étape 1 — Agent PO (clarification)

**Rôle :** S'assurer de la bonne compréhension du besoin avant toute rédaction.

En te basant sur la description `$ARGUMENTS` et le contexte projet, identifie les zones d'ambiguïté ou les choix non triviaux. Pose **toutes les questions nécessaires à la compréhension complète de la feature** — ne suppose rien de non évident.

Questions typiques à envisager :
- Quel est le déclencheur de ce besoin (bug, demande produit, contrainte technique) ?
- Quels utilisateurs / rôles sont concernés ?
- Y a-t-il des cas limites ou des comportements edge à préciser ?
- Quelle est la priorité / urgence ?
- Y a-t-il des contraintes de compatibilité avec l'existant ?
- Quels sont les critères qui définissent que la feature est "terminée" ?

**Attends les réponses de l'utilisateur avant de continuer.**

---

## Étape 2 — Génération du titre

À partir de la description `$ARGUMENTS` et des réponses obtenues, génère :
- Un **titre court** en anglais (3-5 mots, kebab-case pour le nom de fichier) — ex: `projects-collection`
- Un **titre lisible** en français pour TASKS.md — ex: `Collection Projects`

Propose-les à l'utilisateur et demande confirmation ou ajustement.

---

## Étape 3 — Agent Architecte / Lead Tech

**Rôle :** Prendre les décisions techniques et définir la structure d'implémentation.

En s'appuyant sur les réponses du PO :
- Lister les décisions techniques (format : décision / alternatives considérées / justification)
- Définir la structure des fichiers à créer ou modifier (tableau `Fichier | Action`)
- Identifier les dépendances entre fichiers et l'ordre d'implémentation
- Signaler les points d'attention TypeScript / Payload / NX

Si des choix techniques sont non triviaux ou ont plusieurs options valides, **pose des questions à l'utilisateur** avant de trancher.

**Sources à consulter :** `apps/cms/src/collections/`, `apps/cms/src/seed/`, ADR existants.

**Vérification seed obligatoire :** Si la feature crée une nouvelle collection, vérifie si elle est couverte par un seed dans `apps/cms/src/seed/`. Si ce n'est pas le cas, **pose explicitement la question** :
> « La collection `<Nom>` n'a pas de seed. Faut-il ajouter des données de dev dans `pnpm seed` (`src/seed/run.ts`) ? »
>
> Si oui, documente dans les étapes d'implémentation : création de `src/seed/<collection>/index.ts` (classe `<Collection>Seed`) et import dans `run.ts`.

**Attends la validation de l'utilisateur sur les décisions clés avant de continuer.**

---

## Étape 4 — Agent Spec Writer

**Rôle :** Rédiger le fichier de feature exécutable `docs/features/NNN-titre.md`.

Contenu obligatoire :
- **Contexte** — besoin consolidé (PO + réponses utilisateur)
- **Décisions prises** — tableau synthétique (issu de l'Architecte)
- **Fichiers à créer / modifier** — tableau
- **Étapes d'implémentation** — chaque étape doit être suffisamment détaillée pour qu'un agent de développement l'exécute sans ambiguïté : noms de classes, signatures de méthodes, patterns à suivre, transformations de données
- **Vérification** — commandes à lancer

**Contrainte :** Le fichier doit être auto-suffisant. Un agent sans contexte préalable doit pouvoir l'exécuter avec uniquement ce fichier + `CLAUDE.md`.

---

## Étape 5 — Agent ADR Writer

**Rôle :** Documenter les décisions architecturales dans `docs/adr/00NN-titre.md`.

Format ADR standard du projet (voir `docs/adr/0001-programs-collection.md`) :
- Date, Statut (`Accepté`), Décideurs
- Contexte
- Une section par décision (Décision / Alternatives considérées / Justification)
- Conséquences

---

## Étape 6 — Mise à jour `docs/features/TASKS.md`

Ajouter une ligne : `| NNN | Titre lisible | planned | — | YYYY-MM-DD |`

---

## Résultat attendu

Fichiers créés :
- `docs/features/NNN-titre.md`
- `docs/adr/00NN-titre.md`
- `docs/features/TASKS.md` mis à jour

Affiche un récapitulatif des décisions clés et confirme le numéro et le titre retenus.
