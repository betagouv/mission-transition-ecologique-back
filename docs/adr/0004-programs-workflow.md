# ADR 0004 — Workflow de validation des programmes

**Date :** 2026-03-16
**Feature :** [002-programs-workflow](../features/002-programs-workflow.md)
**Statut :** ⚠️ **Obsolète** — superseded par [ADR 0005 — Workflow des programmes — états étendus](0005-programs-workflow-extended.md) (2026-04-30)
**Décideurs :** PO, Tech Lead

> Cet ADR documente la première itération du workflow (4 états, 4 rôles). Le modèle a été refondu par l'ADR 0005 pour refléter le diagramme produit cible (9 états, 3 rôles). Conservé pour l'historique des décisions.

---

## Contexte

La collection `Programs` utilise le système natif `versions: { drafts: true }` de Payload avec un champ `_status` binaire (`draft` / `published`). Ce modèle ne représente pas le cycle de vie éditorial réel :

1. Un **contributeur** rédige un programme et le soumet pour relecture.
2. Un **administrateur-aide** révise et valide le contenu.
3. Un **super-admin** prend la décision de publication.

L'interface native Payload ne reflète pas ces transitions : le bouton "Publish" est visible pour tous les rôles ayant accès à l'édition, et aucun état intermédiaire n'est affiché.

---

## Décisions

### 1. Champ `workflowStatus` séparé de `_status`

**Décision :** Ajouter un champ `workflowStatus` (select, 4 valeurs) sur `Programs`, distinct du champ `_status` géré par Payload.

| Valeur | Description |
|--------|-------------|
| `brouillon` | Rédaction en cours (valeur par défaut à la création) |
| `en-revision` | Soumis pour relecture par un admin-aide |
| `valide` | Contenu approuvé, en attente de publication |
| `publie` | Publié publiquement |

**Alternatives considérées :**
- Remplacer `_status` par 4 valeurs : impossible sans forker le comportement interne de Payload (le système de drafts est couplé à `draft`/`published`).
- Utiliser uniquement `_status` avec une surcharge custom : ne permet pas de représenter les états intermédiaires sans casser l'API Payload.

**Justification :**
La coexistence des deux champs permet de conserver les bénéfices du système natif Payload (historique des versions, API `draft: false`) tout en ajoutant une couche de workflow métier explicite.

---

### 2. Synchronisation `workflowStatus → _status` via hook `beforeChange`

**Décision :** Un hook `beforeChange` (`apps/cms/src/hooks/programs/beforeChangeWorkflow.ts`) synchronise automatiquement `_status` en fonction de `workflowStatus` :
- `workflowStatus === 'publie'` → `_status = 'published'`
- tous les autres états → `_status = 'draft'`

**Justification :**
La synchronisation server-side garantit la cohérence entre les deux champs sans dépendre du client. Le hook est également le point d'application de la politique de transitions (validation des droits).

---

### 3. Politique de transitions dans `WorkflowTransitionPolicy`

**Décision :** Les transitions autorisées sont centralisées dans une classe `WorkflowTransitionPolicy` (`apps/cms/src/services/workflow/WorkflowTransitionPolicy.ts`) sans dépendance serveur.

| Transition | Rôles autorisés |
|------------|-----------------|
| `brouillon → en-revision` | contributeur, administrateur-aide, super-admin |
| `en-revision → valide` | administrateur-aide, super-admin |
| `valide → publie` | super-admin |
| Toute autre transition | super-admin uniquement |

La classe est importée côté serveur (hook) et côté client (composant React) pour éviter la duplication de logique.

**Justification :**
Centraliser la matrice de transitions dans un fichier sans dépendances serveur permet de la partager entre la couche de validation serveur et la couche UI sans créer de couplage.

---

### 4. Validation des transitions côté serveur uniquement

**Décision :** La validation des transitions est faite exclusivement dans le hook `beforeChange`. Le composant client ne fait pas confiance à son propre état — il affiche les boutons disponibles, mais la décision finale est prise serveur.

**Justification :**
La validation client-side seule (dans le composant React) serait contournable via l'API REST. La validation serveur est non-contournable.

---

### 5. Historique des transitions via champ `workflowHistory` sur Programs

**Décision :** Un champ `workflowHistory` (array, `readOnly` en UI) est ajouté sur `Programs`. Le hook `beforeChange` l'alimente à chaque transition.

Structure d'une entrée :
```
{ from: string, to: string, changedBy: relation(users), changedAt: date }
```

**Alternatives considérées :**
- Collection séparée `WorkflowTransitions` : plus flexible (requêtes cross-documents, audit global) mais surcharge la stack pour le POC.
- S'appuyer sur l'historique des versions Payload (`_programs_v`) : les versions ne tracent pas explicitement "qui a déclenché quelle transition".

**Justification :**
Un array sur le document est suffisant pour le POC. La migration vers une collection dédiée est possible si un audit cross-documents devient nécessaire.

---

### 6. Remplacement du `PublishButton` natif par `WorkflowActionBar`

**Décision :** Le bouton "Publish" natif est remplacé par `WorkflowActionBar.tsx`, un composant React Client configuré via `admin.components.edit.PublishButton` dans la collection `Programs`.

Le composant :
- Lit `savedDocumentData.workflowStatus` et le rôle de l'utilisateur connecté.
- Affiche uniquement les boutons de transitions disponibles pour ce rôle et ce statut.
- Désactive les boutons si le formulaire a des modifications non sauvegardées (`useFormModified()`).
- Appelle `PATCH /api/programs/:id` avec `{ workflowStatus: newStatus }` et recharge la page.

**Justification :**
Le remplacement du `PublishButton` per-collection (via `admin.components.edit`) évite d'affecter d'autres collections. L'approche `fetch + reload` est pragmatique pour le POC — une intégration plus fine avec le système de formulaire Payload est possible ultérieurement.

---

## Conséquences

- Le champ `workflowStatus` est ajouté à `programs` en base — une migration Payload est nécessaire.
- `payload-types.ts` doit être régénéré : `pnpm nx run @tee-backoffice/cms:generate:types`.
- `importMap.js` doit être régénéré après l'ajout des composants custom : `pnpm nx run @tee-backoffice/cms:generate:importmap`.
- Les programmes seedés existants (`_status: 'published'`) devront recevoir `workflowStatus: 'publie'` — à gérer dans le script seed ou via une migration manuelle.
- L'`access.update` sur le champ `workflowStatus` ne doit pas bloquer les appels PATCH légitimes des rôles `contributeur` et `administrateur-aide` — la validation des droits est déléguée au hook `beforeChange`.
