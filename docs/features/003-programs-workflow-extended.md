# Feature 003 — Workflow des programmes — états étendus

**ADR :** [0005-programs-workflow-extended](../adr/0005-programs-workflow-extended.md)
**Issue produit :** [betagouv/mission-transition-ecologique#2604](https://github.com/betagouv/mission-transition-ecologique/issues/2604)
**Diagramme cible :** `docs/sources/workflow-programs.png` (NE PAS MODIFIER)
**Supersede :** [Feature 002 — Workflow de validation des programmes](002-programs-workflow.md) / [ADR 0004](../adr/0004-programs-workflow.md)

---

## Contexte

L'implémentation actuelle (feature 002 / ADR 0004) introduit un workflow à 4 états (`brouillon`, `en-revision`, `valide`, `publie`) avec 4 rôles utilisateurs (`super-admin`, `administrateur-aide`, `contributeur`, `observateur`). Le diagramme produit cible `docs/sources/workflow-programs.png` introduit un workflow plus riche à 9 états avec deux acteurs principaux (`creator`, `admin`) et une zone "Automatisé" pour les traitements post-publication.

Cette feature :

1. Refond la matrice de rôles : `creator`, `admin`, `super-admin` (suppression d'`observateur` et d'`administrateur-aide`).
2. Étend les états du workflow programmes à 9 valeurs (renommage de 3, ajout de 6).
3. Ajoute un champ `replacedBy` pour gérer l'état `remplace`.
4. Introduit un point d'extension `WorkflowAutomation` pour la zone automatisée (`en-cours-publication → publie`), implémenté de façon instantanée pour le POC.

**Pas de migration des données** : la base sera reset et reseed. Tous les programmes seedés terminent en `publie`.

**Hors scope :**
- Flux d'import effectif (seul l'état `importe` est ajouté à la matrice, sans UI ni script).
- Mailing automatique post-publication (point d'extension prévu, non implémenté).
- Mécanisme automatique de remplacement (en fonction de la date de fin et de la publication du programme remplaçant).
- Entités annexes du diagramme (`Structures opérateurs`, `Contact opérateurs`, `Projets`).

---

## Décisions prises

| Sujet | Décision |
|-------|----------|
| Rôles | `creator`, `admin`, `super-admin` (admin = mêmes droits que super-admin pour le POC, distinction conservée pour évolution future) |
| États | 9 statuts : `en-creation`, `en-relecture`, `en-cours-publication`, `publie`, `en-cours-modification`, `importe`, `annule`, `archive`, `remplace` |
| Migration | Aucune. DB reset + reseed. Les programmes seedés sont créés directement à `publie`. |
| `Modifier` depuis `Publié` | S'appuie sur Payload `versions: { drafts: true }` — la version publiée précédente reste exposée. |
| `Remplacer` | Ajout d'un champ `replacedBy` (relation `programs`, requis lors de la transition vers `remplace`). |
| Phase automatisée | Transition instantanée `en-cours-publication → publie` dans le hook serveur, point d'extension `WorkflowAutomation`. |
| Création initiale | Démarre toujours en `en-creation`. Pas de bouton "demander publication" sur le formulaire de création. |
| Annulation / archivage | Final. Pas de restauration ni de désarchivage pour le POC. |
| Validation des transitions | Centralisée dans `WorkflowTransitionPolicy` (server + client) + hook `beforeChange`. |
| ADR 0004 | Marquée obsolète, lien vers ADR 0005. |

### Matrice des transitions

| De | Vers | Action UI | Rôles |
|----|------|-----------|-------|
| _(création)_ | `en-creation` | sauvegarde initiale (`defaultValue`) | creator, admin, super-admin |
| `en-creation` | `en-relecture` | "Demander la relecture" | creator, admin, super-admin |
| `en-creation` | `annule` | "Annuler" | creator, admin, super-admin |
| `en-relecture` | `en-cours-publication` | "Publier" | admin, super-admin |
| `en-relecture` | `en-cours-modification` | "Enregistrer le brouillon" Payload (auto) | createur, admin, super-admin |
| `en-relecture` | `annule` | "Annuler" | admin, super-admin |
| `en-cours-publication` | `publie` | _automatique (instantané)_ | système (hook) |
| `en-cours-publication` | `annule` | "Annuler" | admin, super-admin |
| `publie` | `en-cours-modification` | "Modifier" _ou_ "Enregistrer le brouillon" Payload (auto) | admin, super-admin |
| `en-cours-modification` | `en-relecture` | "Demander la relecture" | createur, admin, super-admin |
| `en-cours-modification` | `en-cours-publication` | "Publier" | admin, super-admin |
| `publie` | `archive` | "Archiver" | admin, super-admin |
| `publie` | `remplace` | "Remplacer" (avec `replacedBy`) | admin, super-admin |
| `importe` | `en-relecture` | "Enregistrer en relecture" | admin, super-admin |

Le `super-admin` peut effectuer toute transition (override universel).

---

## Fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `apps/cms/src/utils/user/UserRole.ts` | **Modifier** — refactor rôles (`CREATOR`, `ADMIN`, `SUPER_ADMIN`), suppression d'`OBSERVATEUR` et `ADMIN_AIDE`/`CONTRIBUTEUR`, méthodes `isAdmin` / `isCreator` |
| `apps/cms/tests/unit/UserRole.spec.ts` | **Modifier** — adapter les tests aux nouveaux rôles |
| `apps/cms/src/collections/Users.ts` | **Modifier** — `defaultValue` du rôle, conditions `condition` |
| `apps/cms/src/services/access/AuthAccessPolicy.ts` | **Modifier** — renommer `isAdminOrAbove` → `isAdmin`, conserver `isSuperAdmin`, `isAuthenticated` |
| `apps/cms/src/services/access/ProgramAccessPolicy.ts` | **Modifier** — adapter aux nouveaux rôles, gérer `assignedContributors` avec `creator` |
| `apps/cms/src/services/access/OperatorAccessPolicy.ts` | **Modifier** — `isAdmin` au lieu d'`isAdminAide` |
| `apps/cms/src/scripts/seed/users/index.ts` | **Modifier** — utilisateurs : `super.admin@tee.test`, `admin@tee.test`, `createur@tee.test` (suppression d'`observateur@tee.test`) |
| `apps/cms/src/services/workflow/WorkflowTransitionPolicy.ts` | **Modifier** — étendre `WorkflowStatus` à 9 valeurs, refondre `ALLOWED_TRANSITIONS`, retirer `valide`/`brouillon`/`en-revision` |
| `apps/cms/src/services/workflow/WorkflowAutomation.ts` | **Créer** — orchestre la phase automatisée `en-cours-publication → publie` (instantané pour le POC + extension point) |
| `apps/cms/src/hooks/programs/beforeChangeWorkflow.ts` | **Modifier** — intégrer `WorkflowAutomation`, valider `replacedBy`, gérer `_status` (publie ou en-cours-modification) |
| `apps/cms/src/components/programs/WorkflowActionBar.tsx` | **Modifier** — adapter au nouveau set de rôles, gestion du cas `remplace` (ouverture d'un mini-prompt pour saisir le remplaçant) |
| `apps/cms/src/components/programs/WorkflowStatusBadge.tsx` | **Modifier** — ajouter les libellés/couleurs pour les nouveaux états |
| `apps/cms/src/collections/Programs.ts` | **Modifier** — étendre `workflowStatus.options`, ajouter `replacedBy`, mettre à jour `defaultValue` (`en-creation`), retirer accès `_status` superflus |
| `apps/cms/src/scripts/seed/programs/ProgramMapper.ts` | **Modifier** — mapper les programmes seedés à `workflowStatus: 'publie'` |
| `docs/adr/0004-programs-workflow.md` | **Modifier** — marquer obsolète + lien vers ADR 0005 |
| `docs/adr/0005-programs-workflow-extended.md` | **Créer** |
| `docs/adr/0002-user-roles-and-access-control.md` | **Modifier** — actualiser tableaux de rôles + matrice |
| `CLAUDE.md` | **Modifier** — table des utilisateurs de dev |
| `apps/cms/src/app/(payload)/admin/importMap.js` | **Régénérer** — `pnpm nx run @tee-backoffice/cms:generate:importmap` |
| `apps/cms/src/payload-types.ts` | **Régénérer** — `pnpm nx run @tee-backoffice/cms:generate:types` (après build de Payload) |

---

## Étapes d'implémentation

### Étape 1 — Refactor `UserRole`

Modifier `apps/cms/src/utils/user/UserRole.ts` :

- Remplacer les constantes :
  - `SUPER_ADMIN = 'super-admin'` (inchangé)
  - **Nouveau :** `ADMIN = 'admin'`
  - **Nouveau :** `CREATOR = 'creator'`
  - **Supprimer :** `ADMIN_AIDE`, `CONTRIBUTEUR`, `OBSERVATEUR`
- Mettre à jour `options` (3 entrées : `Super Admin`, `Admin`, `Créateur`).
- Hiérarchie : `[CREATOR, ADMIN, SUPER_ADMIN]` (ordre croissant).
- Méthodes :
  - `isSuperAdmin(user)` — inchangé
  - **Renommer :** `isAdminAide` → `isAdmin` (vérifie `>= ADMIN`)
  - **Renommer :** `isContributeur` → `isCreator` (vérifie `>= CREATOR`)
  - **Supprimer :** `isObservateur`
  - `isAtLeast` — inchangé
- `UserRoleValue` mis à jour.

### Étape 2 — Adapter les tests `UserRole.spec.ts`

Réécrire les tests pour le nouveau set de rôles. Conserver la couverture sur `isSuperAdmin`, `isAdmin`, `isCreator`, `isAtLeast`. Supprimer les tests sur `isObservateur` / `isAdminAide` / `isContributeur`.

### Étape 3 — Mettre à jour `Users` collection et seed

`apps/cms/src/collections/Users.ts` :
- `defaultValue: UserRole.CREATOR` (à la place de `OBSERVATEUR`).

`apps/cms/src/scripts/seed/users/index.ts` :

```ts
const FIXTURES: UserFixture[] = [
  { email: 'super.admin@tee.test', role: UserRole.SUPER_ADMIN },
  {
    email: 'admin@tee.test',
    role: UserRole.ADMIN,
    team: 'ADEME Grand Est',
    region: 'Grand Est',
    operatorSlug: 'ademe',
  },
  {
    email: 'createur@tee.test',
    role: UserRole.CREATOR,
    team: 'CCI Grand Est',
    region: 'Grand Est',
    operatorSlug: 'ademe',
  },
]
```

(Suppression complète de l'utilisateur `observateur@tee.test`.)

### Étape 4 — Adapter les access policies

#### `AuthAccessPolicy.ts`
- Renommer `isAdminOrAbove` → `isAdmin` (utilise `UserRole.isAdmin`).
- Conserver `isAuthenticated`, `isSuperAdmin`.

#### `ProgramAccessPolicy.ts`
- Remplacer `UserRole.isAdminAide(user)` → `UserRole.isAdmin(user)`.
- Remplacer `UserRole.isContributeur(user)` → `UserRole.isCreator(user)`.
- La logique métier reste identique (admin = mêmes droits que super-admin, créateur = filtré par `assignedContributors`).

#### `OperatorAccessPolicy.ts`
- Idem (`isAdmin` au lieu d'`isAdminAide`).

### Étape 5 — Étendre `WorkflowTransitionPolicy`

Modifier `apps/cms/src/services/workflow/WorkflowTransitionPolicy.ts`. Ce fichier reste **sans dépendance serveur** (utilisé client + serveur).

```ts
import type { UserRoleValue } from '@/utils/user/UserRole'
import { UserRole } from '@/utils/user/UserRole'

export type WorkflowStatus =
  | 'en-creation'
  | 'en-relecture'
  | 'en-cours-publication'
  | 'publie'
  | 'en-cours-modification'
  | 'importe'
  | 'annule'
  | 'archive'
  | 'remplace'

export type { UserRoleValue as UserRole }

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  'en-creation': 'En création',
  'en-relecture': 'En relecture',
  'en-cours-publication': 'En cours de publication',
  publie: 'Publié',
  'en-cours-modification': 'En cours de modification',
  importe: 'Importé',
  annule: 'Annulé',
  archive: 'Archivé',
  remplace: 'Remplacé',
}

export const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
  'en-creation': 'bg-gray-100 text-gray-700',
  'en-relecture': 'bg-yellow-100 text-yellow-800',
  'en-cours-publication': 'bg-orange-100 text-orange-800',
  publie: 'bg-green-100 text-green-800',
  'en-cours-modification': 'bg-blue-100 text-blue-800',
  importe: 'bg-purple-100 text-purple-800',
  annule: 'bg-red-100 text-red-700',
  archive: 'bg-stone-200 text-stone-700',
  remplace: 'bg-indigo-100 text-indigo-700',
}

export const TRANSITION_LABELS: Partial<Record<WorkflowStatus, string>> = {
  'en-relecture': 'Demander la relecture',
  'en-cours-publication': 'Publier',
  'en-cours-modification': 'Modifier',
  annule: 'Annuler',
  archive: 'Archiver',
  remplace: 'Remplacer',
}

export const FINAL_STATUSES: ReadonlySet<WorkflowStatus> = new Set([
  'annule',
  'archive',
  'remplace',
])

// Status that triggers automated post-publishing pipeline.
export const AUTOMATED_PUBLISH_STATUS: WorkflowStatus = 'en-cours-publication'

const ALLOWED_TRANSITIONS: Record<WorkflowStatus, Partial<Record<UserRoleValue, WorkflowStatus[]>>> = {
  'en-creation': {
    [UserRole.CREATOR]: ['en-relecture', 'annule'],
    [UserRole.ADMIN]: ['en-relecture', 'annule'],
  },
  'en-relecture': {
    [UserRole.ADMIN]: ['en-cours-publication', 'annule'],
  },
  'en-cours-publication': {
    [UserRole.ADMIN]: ['annule'],
    // 'publie' is reached automatically by the server-side hook, never via UI.
  },
  publie: {
    [UserRole.ADMIN]: ['en-cours-modification', 'archive', 'remplace'],
  },
  'en-cours-modification': {
    [UserRole.ADMIN]: ['en-relecture', 'en-cours-publication'],
  },
  importe: {
    [UserRole.ADMIN]: ['en-relecture'],
  },
  annule: {},
  archive: {},
  remplace: {},
}

export class WorkflowTransitionPolicy {
  static canTransition(from: WorkflowStatus, to: WorkflowStatus, role: UserRoleValue): boolean {
    if (UserRole.isSuperAdmin({ role })) return true
    return ALLOWED_TRANSITIONS[from]?.[role]?.includes(to) ?? false
  }

  static getAllowedTransitions(from: WorkflowStatus, role: UserRoleValue): WorkflowStatus[] {
    if (UserRole.isSuperAdmin({ role })) {
      const all: WorkflowStatus[] = [
        'en-creation', 'en-relecture', 'en-cours-publication', 'publie',
        'en-cours-modification', 'importe', 'annule', 'archive', 'remplace',
      ]
      return all.filter((s) => s !== from)
    }
    return ALLOWED_TRANSITIONS[from]?.[role] ?? []
  }

  static isFinal(status: WorkflowStatus): boolean {
    return FINAL_STATUSES.has(status)
  }

  static requiresReplacement(status: WorkflowStatus): boolean {
    return status === 'remplace'
  }
}
```

### Étape 6 — Créer `WorkflowAutomation`

Créer `apps/cms/src/services/workflow/WorkflowAutomation.ts`.

Cette classe centralise la logique de la phase automatisée. Pour le POC, elle effectue immédiatement la transition `en-cours-publication → publie` ; les futurs traitements (mailing, vérification de date) sont marqués par des commentaires `// TODO`.

```ts
import type { Payload } from 'payload'
import type { WorkflowStatus } from './WorkflowTransitionPolicy'

export interface AutomationContext {
  payload: Payload
  programId: string | number
  validityStart?: Date | null
}

export class WorkflowAutomation {
  /**
   * Runs the post-`en-cours-publication` automated pipeline.
   *
   * For the POC, this is an instantaneous pass-through that returns `'publie'`.
   * The intent is to keep a single explicit point of extension for:
   *  - sending publication mailings
   *  - delaying publication until validityStart <= today
   *  - any other automated post-publish step
   *
   * @returns The next workflow status. `null` means "stay in `en-cours-publication`".
   */
  static runPublishingPipeline(_ctx: AutomationContext): WorkflowStatus | null {
    // TODO(workflow): trigger publication mailing (mission-transition-ecologique#2604)
    // TODO(workflow): if validityStart > today, return null and persist 'en-cours-publication'
    return 'publie'
  }
}
```

### Étape 7 — Mettre à jour `beforeChangeWorkflow`

Modifier `apps/cms/src/hooks/programs/beforeChangeWorkflow.ts`. La logique change sur trois points :

1. **Statut initial à la création** : `en-creation` (au lieu de `brouillon`).
2. **Synchronisation `_status`** : `_status = 'published'` **uniquement si** `workflowStatus === 'publie'`. Tout autre statut → `_status = 'draft'`.
3. **Transition `remplace`** : exiger `replacedBy` non vide, refuser sinon.
4. **Transition vers `en-cours-publication`** : appeler `WorkflowAutomation.runPublishingPipeline()` puis, si retour `'publie'`, écraser `data.workflowStatus = 'publie'` dans la même requête.

```ts
import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import {
  WorkflowTransitionPolicy,
  type WorkflowStatus,
} from '@/services/workflow/WorkflowTransitionPolicy'
import { WorkflowAutomation } from '@/services/workflow/WorkflowAutomation'
import type { UserRoleValue } from '@/utils/user/UserRole'

export const beforeChangeWorkflow: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  if (operation === 'create') {
    data.workflowStatus = data.workflowStatus ?? 'en-creation'
    data._status = data.workflowStatus === 'publie' ? 'published' : 'draft'
    return data
  }

  const previousStatus = (originalDoc?.workflowStatus ?? 'en-creation') as WorkflowStatus
  const nextStatusInput = data.workflowStatus as WorkflowStatus | undefined

  if (!nextStatusInput || nextStatusInput === previousStatus) return data

  const role = req.user?.role as UserRoleValue | undefined
  if (!role) throw new APIError('Utilisateur non authentifié', 401)

  if (!WorkflowTransitionPolicy.canTransition(previousStatus, nextStatusInput, role)) {
    throw new APIError(
      `Transition non autorisée : ${previousStatus} → ${nextStatusInput} pour le rôle ${role}`,
      403,
    )
  }

  // Validate `remplace` requires a target program.
  if (WorkflowTransitionPolicy.requiresReplacement(nextStatusInput)) {
    if (!data.replacedBy) {
      throw new APIError(
        'Un programme remplaçant doit être renseigné (champ "Remplacé par") pour passer à l’état "Remplacé".',
        400,
      )
    }
  }

  // Run automated pipeline when entering `en-cours-publication`.
  let resolvedStatus: WorkflowStatus = nextStatusInput
  if (nextStatusInput === 'en-cours-publication') {
    const auto = WorkflowAutomation.runPublishingPipeline({
      payload: req.payload,
      programId: originalDoc?.id as string | number,
      validityStart: data.validityStart ?? originalDoc?.validityStart ?? null,
    })
    if (auto !== null) resolvedStatus = auto
  }

  data.workflowStatus = resolvedStatus
  data._status = resolvedStatus === 'publie' ? 'published' : 'draft'

  // Append a single history entry that reflects the resolved transition.
  const historyEntry = {
    from: previousStatus,
    to: resolvedStatus,
    changedBy: req.user?.id,
    changedAt: new Date().toISOString(),
  }
  data.workflowHistory = [...(originalDoc?.workflowHistory ?? []), historyEntry]

  return data
}
```

> **Note :** quand `runPublishingPipeline` retourne `'publie'` (cas POC), une seule entrée d'historique est créée pour `previousStatus → publie`. Si plus tard la pipeline persiste un état intermédiaire (`return null`), le hook créera l'entrée `previousStatus → en-cours-publication`, puis une autre transition (ultérieure) créera `en-cours-publication → publie`.

### Étape 8 — Étendre `WorkflowActionBar`

Modifier `apps/cms/src/components/programs/WorkflowActionBar.tsx` pour gérer le cas `remplace` (sélection d'un programme remplaçant).

Comportement :
- Si l'utilisateur sélectionne `remplace` dans le `<SelectInput>`, ouvrir un prompt natif (`window.prompt` pour le POC) demandant l'ID du programme remplaçant. Soumettre avec `overrides: { workflowStatus: 'remplace', replacedBy: <id> }`.
- Pour toutes les autres transitions, comportement actuel inchangé.
- Ne plus filtrer sur `UserRole.OBSERVATEUR` (ce rôle n'existe plus).

```tsx
'use client'

import React from 'react'
import { useDocumentInfo, useAuth, useForm, useFormModified, SelectInput } from '@payloadcms/ui'
import type { ReactSelectOption } from '@payloadcms/ui'
import {
  WorkflowTransitionPolicy,
  WORKFLOW_STATUS_LABELS,
  TRANSITION_LABELS,
  type WorkflowStatus,
} from '@/services/workflow/WorkflowTransitionPolicy'
import type { UserRoleValue } from '@/utils/user/UserRole'

export const WorkflowActionBar: React.FC = () => {
  const { data } = useDocumentInfo()
  const { user } = useAuth()
  const { submit } = useForm()
  const isModified = useFormModified()

  const currentStatus = (data?.workflowStatus ?? 'en-creation') as WorkflowStatus
  const role = user?.role as UserRoleValue | undefined

  const availableTransitions = role
    ? WorkflowTransitionPolicy.getAllowedTransitions(currentStatus, role)
    : []

  if (availableTransitions.length === 0) return null

  const options = [currentStatus, ...availableTransitions].map((status) => ({
    label: TRANSITION_LABELS[status] ?? WORKFLOW_STATUS_LABELS[status],
    value: status,
  }))

  const handleChange = (option: ReactSelectOption | ReactSelectOption[]) => {
    if (Array.isArray(option)) return
    const to = option.value as WorkflowStatus
    if (to === currentStatus) return

    if (WorkflowTransitionPolicy.requiresReplacement(to)) {
      const replacementId = window.prompt(
        'ID du programme remplaçant (champ "id" du programme cible) :',
      )
      if (!replacementId) return
      void submit({ overrides: { workflowStatus: to, replacedBy: replacementId } })
      return
    }

    void submit({ overrides: { workflowStatus: to } })
  }

  return (
    <SelectInput
      name="workflowStatusTransition"
      path="workflowStatusTransition"
      options={options}
      value={currentStatus}
      onChange={handleChange}
      isClearable={false}
      readOnly={isModified}
    />
  )
}
```

> **Note :** `window.prompt` est volontairement minimal pour le POC. Une UX plus fine (modal Payload + relation picker) est laissée à une feature ultérieure.

### Étape 9 — Mettre à jour `WorkflowStatusBadge`

Modifier `apps/cms/src/components/programs/WorkflowStatusBadge.tsx` pour supporter les 9 nouveaux libellés/couleurs.

Le composant existant lit `WORKFLOW_STATUS_LABELS` et `WORKFLOW_STATUS_COLORS` depuis `WorkflowTransitionPolicy` — les nouveaux libellés sont automatiquement pris en compte. Vérifier qu'il gère bien le cas où `cellData` est l'un des nouveaux statuts (pas de fallback caché à `'brouillon'` qui n'existe plus).

Si la valeur par défaut actuelle est `'brouillon'`, la remplacer par `'en-creation'`.

### Étape 10 — Modifier la collection `Programs`

Dans `apps/cms/src/collections/Programs.ts` :

**10a. Mettre à jour le champ `workflowStatus` :**
```ts
{
  name: 'workflowStatus',
  type: 'select',
  label: 'Statut de workflow',
  defaultValue: 'en-creation',
  required: true,
  options: [
    { label: 'En création', value: 'en-creation' },
    { label: 'En relecture', value: 'en-relecture' },
    { label: 'En cours de publication', value: 'en-cours-publication' },
    { label: 'Publié', value: 'publie' },
    { label: 'En cours de modification', value: 'en-cours-modification' },
    { label: 'Importé', value: 'importe' },
    { label: 'Annulé', value: 'annule' },
    { label: 'Archivé', value: 'archive' },
    { label: 'Remplacé', value: 'remplace' },
  ],
  admin: { position: 'sidebar' },
},
```

**10b. Ajouter le champ `replacedBy` immédiatement après `workflowStatus` :**
```ts
{
  name: 'replacedBy',
  type: 'relationship',
  label: 'Remplacé par',
  relationTo: 'programs',
  hasMany: false,
  admin: {
    position: 'sidebar',
    description:
      'Programme de remplacement. Requis lors du passage à l’état "Remplacé".',
    condition: (data) =>
      data?.workflowStatus === 'remplace' || Boolean(data?.replacedBy),
  },
  filterOptions: ({ id }) => ({
    // Exclure le programme courant (pas d'auto-remplacement) et les états finaux.
    and: [
      { id: { not_equals: id } },
      { workflowStatus: { not_in: ['annule', 'archive', 'remplace'] } },
    ],
  }),
},
```

**10c. Adapter le champ `_status.access.update` :**
```ts
access: {
  update: (({ req: { user } }) => {
    if (!user) return false
    return UserRole.isAdmin(user)
  }) satisfies FieldAccess,
},
```

**10d. Adapter `assignedContributors.access.update` :**
```ts
access: {
  update: (({ req: { user } }) => UserRole.isAdmin(user)) satisfies FieldAccess,
},
```

### Étape 11 — Adapter le seed des programmes

Dans `apps/cms/src/scripts/seed/programs/ProgramMapper.ts` (ou équivalent qui produit l'objet inséré), forcer `workflowStatus: 'publie'` (et `_status: 'published'`) pour tous les programmes seedés. Vérifier qu'aucun mapper ne renvoie `'brouillon'`, `'en-revision'` ou `'valide'`.

> Si `ProgramMapper` ne fixe pas `workflowStatus`, ajouter une assignation explicite dans `ProgramImporter` au moment du `payload.create`.

### Étape 12 — Mettre à jour `CLAUDE.md`

Section "Utilisateurs de dev" :

| Email | Mot de passe | Rôle |
|---|---|---|
| `super.admin@tee.test` | `super.admin@tee.test` | `super-admin` |
| `admin@tee.test` | `admin@tee.test` | `admin` |
| `createur@tee.test` | `createur@tee.test` | `creator` |

(Suppression de la ligne `observateur@tee.test`.)

### Étape 13 — Mettre à jour ADR 0002

Dans `docs/adr/0002-user-roles-and-access-control.md`, mettre à jour les tableaux de rôles et la matrice. Marquer en haut de fichier que la matrice de rôles a été refondue par ADR 0005 (avec lien).

### Étape 14 — Régénérer types et import map

Dans cet ordre, depuis la racine du workspace :

```sh
# 1. Reset DB pour repartir d'une base propre (le schéma change)
rm -f apps/cms/data/payload.db apps/cms/payload.db 2>/dev/null

# 2. Regénérer les types Payload
pnpm nx run @tee-backoffice/cms:generate:types

# 3. Regénérer l'import map (composants custom inchangés en chemin, mais à refaire par sécurité)
pnpm nx run @tee-backoffice/cms:generate:importmap

# 4. Reseed
pnpm seed
```

---

## Vérification

```sh
# 1. Lint
pnpm nx affected -t lint

# 2. Typecheck (pas de target nx, lancer tsc directement)
PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" node_modules/.bin/tsc --noEmit -p apps/cms/tsconfig.json

# 3. Tests unitaires
PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH" pnpm nx run @tee-backoffice/cms:test
# (ou via vitest direct si la cible n'existe pas)

# 4. Build
pnpm nx run @tee-backoffice/cms:build

# 5. Vérification manuelle dans l'admin Payload :
#    - Connecté en créateur :
#      - création d'un programme → démarre en `en-creation`
#      - peut transitionner vers `en-relecture` ou `annule`
#      - ne voit pas les boutons `Publier`, `Archiver`, `Remplacer`, `Modifier`
#    - Connecté en admin :
#      - sur un programme en `en-relecture`, peut publier → passe immédiatement à `publie`
#        (l'état `en-cours-publication` n'est pas visible car la pipeline est instantanée)
#      - sur un programme `publie`, peut Modifier (nouvelle version draft), Archiver, Remplacer
#      - le bouton Remplacer ouvre une prompt et exige un id
#    - Connecté en super-admin : toutes les transitions sont disponibles.
#    - L'historique `workflowHistory` est rempli correctement à chaque transition.
#    - Le programme `Publié` ayant été modifié reste accessible via l'API publique
#      (`GET /api/programs?where[slug][equals]=...&draft=false`) tant que la nouvelle version
#      n'est pas elle-même publiée.
```

---

## Suivis post-feature

- **Mailing automatique** : implémenter `WorkflowAutomation.runPublishingPipeline()` avec un job Payload + envoi mail.
- **Vérification date de début** : passer `en-cours-publication` à `publie` uniquement si `validityStart <= today`, sinon programmer un job différé.
- **Mécanisme automatique de remplacement** : transition `publie → remplace` automatique si `validityEnd <= today` et qu'un programme `replacedBy` est `publie`.
- **Visibilité publique des programmes `Remplacé` / `Archivé`** : décision produit (laisser visible avec bandeau ou dépublier).
- **Restauration depuis `Annulé`** : transition à ré-ouvrir si besoin produit.
- **UX du bouton Remplacer** : remplacer `window.prompt` par une modal Payload + relation picker.
- **Flux d'import** : créer le script + la transition `(create) → importe` quand le besoin sera précisé.
