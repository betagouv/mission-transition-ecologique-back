# Features — Workflow AI

## Principe

Chaque feature d'implémentation est un fichier numéroté dans ce dossier.
Le statut global est suivi dans `TASKS.md`.

## Créer une nouvelle feature

1. Numéroter le fichier : `NNN-nom-feature.md` (ex : `002-users-roles.md`)
2. Remplir le template (voir ci-dessous)
3. Ajouter une ligne dans `TASKS.md` avec statut `planned`

## Lancer l'exécution

Dans Claude Code :

```
/execute-feature NNN
```

Claude Code lira le fichier de feature et exécutera toutes les étapes.

## Template de feature

```markdown
# Feature NNN — Nom

## Contexte
Pourquoi cette feature, quel besoin.

## Décisions prises
Liste des choix validés.

## Fichiers à créer / modifier
| Fichier | Action |
|---------|--------|
| `path/to/file.ts` | Créer / Modifier |

## Étapes d'implémentation
1. ...
2. ...

## Vérification
- Commandes à lancer pour valider
```
