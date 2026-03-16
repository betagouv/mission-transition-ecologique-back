# Feature 002 — Workflow de validation des programmes

**ADR :** [0004-programs-workflow](../adr/0004-programs-workflow.md)

## Contexte

La collection `Programs` utilise le système natif `versions: { drafts: true }` de Payload avec deux états `_status` : `draft` et `published`. Ce binaire ne reflète pas le workflow éditorial réel : un contributeur rédige, un admin-aide valide, un super-admin publie.

Cette feature ajoute un champ métier `workflowStatus` (4 états) qui coexiste avec `_status`. Les boutons d'action natifs Payload sont remplacés par un composant contextuel au statut courant et au rôle de l'utilisateur. Un historique visible des transitions est stocké directement sur le document.

**Scope :** collection `Programs` uniquement.

---

## Décisions prises

| Sujet | Décision |
|-------|----------|
| Champ statut métier | `workflowStatus` (select, 4 valeurs) séparé de `_status` |
| Sync `_status` | Hook `beforeChange` : `publie → _status=published`, sinon `_status=draft` |
| Validation des transitions | `WorkflowTransitionPolicy` + hook `beforeChange` server-side |
| Historique | Champ `workflowHistory` (array, readOnly UI) sur Programs |
| Bouton custom | `WorkflowActionBar.tsx` remplace le `PublishButton` natif |
| Cell liste | `WorkflowStatusCell.tsx` sur `workflowStatus` |
| Import map | `pnpm generate:importmap` après ajout des composants |

### Matrice des transitions

| De | Vers | Rôles autorisés |
|----|------|-----------------|
| `brouillon` | `en-revision` | contributeur, administrateur-aide, super-admin |
| `en-revision` | `valide` | administrateur-aide, super-admin |
| `valide` | `publie` | super-admin |
| toute → toute | (n'importe) | super-admin uniquement pour les autres cas |

Le `super-admin` peut effectuer n'importe quelle transition dans n'importe quelle direction.

---

## Fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `apps/cms/src/services/workflow/WorkflowTransitionPolicy.ts` | Créer |
| `apps/cms/src/hooks/programs/beforeChangeWorkflow.ts` | Créer |
| `apps/cms/src/components/programs/WorkflowActionBar.tsx` | Créer |
| `apps/cms/src/components/programs/WorkflowStatusCell.tsx` | Créer |
| `apps/cms/src/collections/Programs.ts` | Modifier |

---

## Étapes d'implémentation

### Étape 1 — `WorkflowTransitionPolicy.ts`

Créer `apps/cms/src/services/workflow/WorkflowTransitionPolicy.ts`.

Ce fichier ne doit importer **aucun module serveur** (ni Payload, ni Node.js) — il est utilisé côté client et serveur.

```typescript
export type WorkflowStatus = 'brouillon' | 'en-revision' | 'valide' | 'publie'
export type UserRole = 'super-admin' | 'administrateur-aide' | 'contributeur' | 'observateur'

// Libellés affichés dans l'UI
export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  brouillon: 'Brouillon',
  'en-revision': 'En révision',
  valide: 'Validé',
  publie: 'Publié',
}

// Couleurs CSS Tailwind pour les badges
export const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
  brouillon: 'bg-gray-100 text-gray-700',
  'en-revision': 'bg-yellow-100 text-yellow-800',
  valide: 'bg-blue-100 text-blue-800',
  publie: 'bg-green-100 text-green-800',
}

// Libellé du bouton d'action pour la transition
export const TRANSITION_LABELS: Partial<Record<WorkflowStatus, string>> = {
  'en-revision': 'Soumettre pour révision',
  valide: 'Valider',
  publie: 'Publier',
}

// Transitions autorisées par rôle (hors super-admin qui a tous les droits)
const ALLOWED_TRANSITIONS: Record<WorkflowStatus, Partial<Record<UserRole, WorkflowStatus[]>>> = {
  brouillon: {
    contributeur: ['en-revision'],
    'administrateur-aide': ['en-revision'],
  },
  'en-revision': {
    'administrateur-aide': ['valide'],
  },
  valide: {},
  publie: {},
}

export class WorkflowTransitionPolicy {
  static canTransition(from: WorkflowStatus, to: WorkflowStatus, role: UserRole): boolean {
    if (role === 'super-admin') return true
    return ALLOWED_TRANSITIONS[from]?.[role]?.includes(to) ?? false
  }

  /**
   * Returns the list of statuses reachable from `from` for the given role.
   * Super-admin can reach all statuses except the current one.
   */
  static getAllowedTransitions(from: WorkflowStatus, role: UserRole): WorkflowStatus[] {
    const all: WorkflowStatus[] = ['brouillon', 'en-revision', 'valide', 'publie']
    if (role === 'super-admin') return all.filter((s) => s !== from)
    return ALLOWED_TRANSITIONS[from]?.[role] ?? []
  }
}
```

---

### Étape 2 — `beforeChangeWorkflow.ts`

Créer `apps/cms/src/hooks/programs/beforeChangeWorkflow.ts`.

Ce hook est appelé côté serveur par Payload avant chaque `create` ou `update`.

```typescript
import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import {
  WorkflowTransitionPolicy,
  type WorkflowStatus,
  type UserRole,
} from '@/services/workflow/WorkflowTransitionPolicy'

export const beforeChangeWorkflow: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  // --- CREATE : initialiser workflowStatus à 'brouillon' ---
  if (operation === 'create') {
    data.workflowStatus = data.workflowStatus ?? 'brouillon'
    data._status = 'draft'
    return data
  }

  // --- UPDATE : valider la transition si workflowStatus a changé ---
  const previousStatus = (originalDoc?.workflowStatus ?? 'brouillon') as WorkflowStatus
  const nextStatus = data.workflowStatus as WorkflowStatus | undefined

  // Pas de changement de statut : ne rien faire
  if (!nextStatus || nextStatus === previousStatus) return data

  const role = req.user?.role as UserRole | undefined
  if (!role) throw new APIError('Utilisateur non authentifié', 401)

  if (!WorkflowTransitionPolicy.canTransition(previousStatus, nextStatus, role)) {
    throw new APIError(
      `Transition non autorisée : ${previousStatus} → ${nextStatus} pour le rôle ${role}`,
      403,
    )
  }

  // --- Synchroniser _status avec le statut métier ---
  data._status = nextStatus === 'publie' ? 'published' : 'draft'

  // --- Ajouter une entrée dans l'historique ---
  const historyEntry = {
    from: previousStatus,
    to: nextStatus,
    changedBy: req.user?.id,
    changedAt: new Date().toISOString(),
  }
  data.workflowHistory = [...(originalDoc?.workflowHistory ?? []), historyEntry]

  return data
}
```

---

### Étape 3 — `WorkflowActionBar.tsx`

Créer `apps/cms/src/components/programs/WorkflowActionBar.tsx`.

Ce composant remplace le bouton "Publish" natif dans l'éditeur de document. Il est un composant React Client.

```tsx
'use client'

import React, { useState } from 'react'
import { useDocumentInfo, useAuth, useFormModified } from '@payloadcms/ui'
import {
  WorkflowTransitionPolicy,
  WORKFLOW_STATUS_LABELS,
  TRANSITION_LABELS,
  type WorkflowStatus,
  type UserRole,
} from '@/services/workflow/WorkflowTransitionPolicy'

export const WorkflowActionBar: React.FC = () => {
  const { id, savedDocumentData, collectionSlug } = useDocumentInfo()
  const { user } = useAuth()
  const isModified = useFormModified()
  const [loading, setLoading] = useState(false)

  const currentStatus = (savedDocumentData?.workflowStatus ?? 'brouillon') as WorkflowStatus
  const role = user?.role as UserRole | undefined

  if (!role || role === 'observateur') return null

  const availableTransitions = WorkflowTransitionPolicy.getAllowedTransitions(currentStatus, role)

  if (availableTransitions.length === 0) return null

  const handleTransition = async (to: WorkflowStatus) => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/${collectionSlug}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowStatus: to }),
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body?.errors?.[0]?.message ?? 'Erreur lors du changement de statut')
        return
      }
      // Recharger la page pour refléter le nouveau statut
      window.location.reload()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {isModified && (
        <p style={{ fontSize: '12px', color: '#b45309', margin: 0 }}>
          Enregistrez vos modifications avant de changer le statut.
        </p>
      )}
      {availableTransitions.map((to) => (
        <button
          key={to}
          type="button"
          disabled={loading || isModified}
          onClick={() => handleTransition(to)}
          style={{
            padding: '8px 16px',
            cursor: loading || isModified ? 'not-allowed' : 'pointer',
            opacity: loading || isModified ? 0.6 : 1,
            fontWeight: 'bold',
          }}
        >
          {loading ? '…' : (TRANSITION_LABELS[to] ?? `→ ${WORKFLOW_STATUS_LABELS[to]}`)}
        </button>
      ))}
    </div>
  )
}
```

---

### Étape 4 — `WorkflowStatusCell.tsx`

Créer `apps/cms/src/components/programs/WorkflowStatusCell.tsx`.

Ce composant remplace l'affichage de la colonne `workflowStatus` dans la vue liste.

```tsx
'use client'

import React from 'react'
import type { DefaultCellComponentProps } from 'payload'
import {
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_STATUS_COLORS,
  type WorkflowStatus,
} from '@/services/workflow/WorkflowTransitionPolicy'

export const WorkflowStatusCell: React.FC<DefaultCellComponentProps> = ({ cellData }) => {
  const status = (cellData ?? 'brouillon') as WorkflowStatus
  const label = WORKFLOW_STATUS_LABELS[status] ?? status
  const colorClass = WORKFLOW_STATUS_COLORS[status] ?? ''

  return (
    <span
      className={colorClass}
      style={{
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
```

---

### Étape 5 — Modifier `Programs.ts`

Dans `apps/cms/src/collections/Programs.ts`, effectuer les modifications suivantes.

**5a. Ajouter les imports en tête de fichier :**
```typescript
import { beforeChangeWorkflow } from '@/hooks/programs/beforeChangeWorkflow'
```

**5b. Ajouter `admin.components` dans la config de la collection :**
```typescript
admin: {
  useAsTitle: 'title',
  components: {
    edit: {
      PublishButton: '@/components/programs/WorkflowActionBar#WorkflowActionBar',
    },
  },
},
```

**5c. Ajouter le hook `beforeChange` :**
```typescript
hooks: {
  beforeChange: [beforeChangeWorkflow],
},
```

**5d. Ajouter le champ `workflowStatus` dans la section `// --- Workflow ---` (avant `_status`) :**
```typescript
{
  name: 'workflowStatus',
  type: 'select',
  label: 'Statut de workflow',
  defaultValue: 'brouillon',
  required: true,
  options: [
    { label: 'Brouillon', value: 'brouillon' },
    { label: 'En révision', value: 'en-revision' },
    { label: 'Validé', value: 'valide' },
    { label: 'Publié', value: 'publie' },
  ],
  admin: {
    position: 'sidebar',
    components: {
      Cell: '@/components/programs/WorkflowStatusCell#WorkflowStatusCell',
    },
  },
  access: {
    // Modification uniquement via le hook beforeChange (ou super-admin direct)
    update: (({ req: { user } }) => user?.role === 'super-admin') satisfies FieldAccess,
  },
},
```

> **Note :** l'`access.update` sur `workflowStatus` restreint la modification directe (formulaire Payload) au super-admin. Les transitions des autres rôles passent par `WorkflowActionBar` qui appelle l'API PATCH — le hook `beforeChangeWorkflow` valide côté serveur. Pour que `WorkflowActionBar` puisse appeler l'API pour un rôle `contributeur` ou `admin-aide`, cet `access.update` doit retourner `true` pour ces rôles ou être omis et déléguer la validation au hook.
>
> **Choix recommandé pour le POC :** retirer l'`access.update` sur `workflowStatus` et laisser le hook `beforeChangeWorkflow` faire seul la validation. Cela évite que Payload refuse la requête PATCH avant même d'atteindre le hook.

**5e. Ajouter le champ `workflowHistory` après `workflowStatus` :**
```typescript
{
  name: 'workflowHistory',
  type: 'array',
  label: 'Historique des transitions',
  admin: {
    position: 'sidebar',
    readOnly: true,
    description: 'Historique automatique des changements de statut.',
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      label: 'Depuis',
      admin: { readOnly: true },
    },
    {
      name: 'to',
      type: 'text',
      label: 'Vers',
      admin: { readOnly: true },
    },
    {
      name: 'changedBy',
      type: 'relationship',
      label: 'Par',
      relationTo: 'users',
      admin: { readOnly: true },
    },
    {
      name: 'changedAt',
      type: 'date',
      label: 'Le',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
  ],
},
```

---

### Étape 6 — Regénérer l'import map

Après avoir ajouté les composants custom, regénérer l'import map :

```sh
pnpm nx run @tee-backoffice/cms:generate:importmap
```

Cette commande met à jour `importMap.js` — ne pas modifier manuellement.

---

## Vérification

```sh
# 1. Lint
pnpm nx affected -t lint

# 2. Typecheck
PATH="~/.nvm/versions/node/v24.13.0/bin:$PATH" node_modules/.bin/tsc --noEmit -p apps/cms/tsconfig.json

# 3. Build
pnpm nx run @tee-backoffice/cms:build

# 4. Regénérer les types Payload (après migration DB)
pnpm nx run @tee-backoffice/cms:generate:types

# 5. Vérifier manuellement :
#    - Connecté en contributeur : bouton "Soumettre pour révision" visible sur un brouillon
#    - Connecté en admin-aide : bouton "Valider" visible sur un document "en révision"
#    - Connecté en super-admin : tous les boutons de transition visibles
#    - Historique affiché en sidebar après chaque transition
#    - _status passe à 'published' quand workflowStatus = 'publie'
```
