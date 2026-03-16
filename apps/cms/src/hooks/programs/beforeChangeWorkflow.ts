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
