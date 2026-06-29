# ADR 0008 — Sidebar et vue Versions des dispositifs

**Date :** 2026-06-18
**Statut :** Accepté
**Décideurs :** PO, Tech Lead
**Contexte :** Ticket #6 (Amélioration UX/UI back-office), PR 4 — points 10 et 11

---

## Contexte

Le suivi des changements de statut d'un dispositif était affiché dans la sidebar du formulaire via le champ `workflowHistory` (array `from` / `to` / `changedBy` / `changedAt`, alimenté par le hook `beforeChangeWorkflow`). Cet historique alourdissait la sidebar alors que Payload fournit déjà une vue « Versions » par document.

Deux demandes produit :

- **Point 10** : retirer « Historique des transitions » de la sidebar, sans perdre la donnée.
- **Point 11** : dans la vue « Versions » d'un document, afficher les mêmes informations que l'historique : **Date / Qui / Statut avant (depuis) / Statut après (vers)**, tout en conservant l'accordéon natif de détail des changements entre deux versions.

---

## Décisions

### 1. `workflowHistory` masqué, non supprimé

**Décision :** le champ `workflowHistory` passe de `admin.position: 'sidebar'` à `admin.hidden: true`.

**Justification :** le hook `beforeChangeWorkflow` continue d'écrire l'historique côté serveur (il est indépendant de l'UI). La donnée reste disponible dans l'API et dans chaque snapshot de version. Aucune migration ni perte de données.

### 2. Champ `lastModifiedBy` pour fiabiliser la colonne « Qui »

**Décision :** ajout d'un champ `lastModifiedBy` (`relationship` vers `users`, `admin.hidden: true`, `readOnly`), renseigné à chaque changement par le hook `trackLastModifiedBy` (`data.lastModifiedBy = req.user.id`).

**Justification :** Payload ne stocke pas nativement l'auteur d'une version. En capturant l'auteur dans le document, chaque snapshot de version le porte, ce qui permet d'afficher un « Qui » fiable pour **toutes** les versions (création, sauvegardes, transitions), et pas seulement pour les transitions de workflow présentes dans `workflowHistory`.

### 3. Vue Versions custom, vendorisée depuis la liste native

**Décision :** override de `admin.components.views.edit.versions.Component` par une vue custom. Les pièces de la liste native de Payload (`@payloadcms/next` → `views/Versions`) ne sont pas exportées publiquement ; elles sont donc **recopiées (vendorisées)** dans l'app, puis augmentées :

| Fichier | Rôle |
|---|---|
| `components/programs/versions/ProgramVersionsView.tsx` | Vue serveur. Récupère les versions via l'API publique `payload.findVersions` (au lieu du `fetchVersions` interne), construit les colonnes, rend la table dans un `ListQueryProvider`. |
| `components/programs/versions/VersionsViewClient.tsx` | Table cliente (vendorisée, n'utilise que des exports publics `@payloadcms/ui` : `Table`, `Pagination`, `PerPage`, `useListQuery`). |
| `components/programs/versions/buildProgramVersionColumns.tsx` | Colonnes **Date / Qui / Statut depuis / Statut vers**. « Qui » = `version.lastModifiedBy` ; « vers » = `version.workflowStatus` ; « depuis » = `workflowStatus` de la version précédente (lignes triées du plus récent au plus ancien). |
| `components/programs/versions/CreatedAtCell.tsx` | Cellule date, lien vers la vue détail native `/collections/programs/:id/versions/:versionId`. |

**Justification :**
- Seule la **liste** (`edit.versions`) est surchargée. La vue **détail** d'une version (`edit.version`, non surchargée) reste native : l'accordéon de diff (`RenderFieldsToDiff` / `DiffCollapser`) est donc préservé, atteint via le lien date de chaque ligne.
- Réutiliser `payload.findVersions` (API publique) évite de dépendre d'imports profonds non exposés par le champ `exports` du package.
- Le badge de statut réutilise `WorkflowStatusPill` et `WORKFLOW_STATUS_LABELS`.

---

## Conséquences

- L'historique de workflow n'apparaît plus dans la sidebar mais dans l'onglet « Versions ».
- Nouveau champ `lastModifiedBy` en base (nullable, ajouté sans migration destructrice ; régénération des types Payload).
- Le calcul du « Statut depuis » se fait au sein d'une page de pagination : la version la plus ancienne d'une page n'a pas de précédente dans la page et affiche « — ». Acceptable pour le POC (`maxPerDoc: 100`, limite par défaut 10).
- Composants à réenregistrer dans l'`importMap` (`pnpm generate:importmap`).
- Format de date : la colonne Date lit le `admin.dateFormat` global de Payload (défaut anglais). Il est fixé à `dd/MM/yyyy HH:mm` (français, 24h) dans `payload.config.ts` ; les champs date seule (`validityStart` / `validityEnd`) le surchargent avec `admin.date.displayFormat: 'dd/MM/yyyy'` pour ne pas afficher d'heure.
