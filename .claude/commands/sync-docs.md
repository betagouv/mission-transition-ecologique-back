Analyse les fichiers modifiés depuis le dernier commit (`git diff HEAD --name-only`) et mets à jour la documentation affectée.

## Ce que tu dois vérifier et mettre à jour

Pour chaque fichier modifié, identifie les impacts documentaires selon ces règles :

### CLAUDE.md
- **Section "Seed"** : si des fichiers dans `apps/cms/src/scripts/seed/` ont changé (nouveaux seeders, renommages, nouveaux utilisateurs de dev)
- **Section "Structure des apps"** : si des fichiers/dossiers ont été ajoutés, déplacés ou renommés dans `apps/cms/src/`
- **Index des ADR** : si un nouvel ADR a été ajouté dans `docs/adr/`

### README.md
- **Comptes utilisateurs de développement** : si les fixtures seed users ont changé
- **Tableau de hiérarchie `UserRole`** : si `apps/cms/src/collections/UserRole.ts` a changé

### docs/adr/
Lis l'ADR concerné uniquement si la tâche y est liée. Mets à jour :
- `0001-programs-collection.md` : si `apps/cms/src/collections/Programs.ts` ou ses hooks ont changé
- `0002-user-roles-and-access-control.md` : si `UserRole.ts`, les access policies ou `Users.ts` ont changé
- `0003-projects-collection.md` : si `apps/cms/src/collections/Projects.ts` a changé
- `0004-programs-workflow.md` : si `WorkflowTransitionPolicy.ts`, `WorkflowActionBar.tsx` ou `beforeChangeWorkflow.ts` ont changé

### docs/context/
Mets à jour les fichiers de contexte métier si le schéma d'une collection ou la logique métier a changé.

## Règles

- Ne modifie que ce qui est réellement impacté par les changements détectés
- Ne réécris pas ce qui est encore exact
- Si aucune mise à jour n'est nécessaire pour un fichier, ne le touche pas
- Signale à la fin ce qui a été mis à jour et pourquoi, ou confirme que tout est déjà à jour