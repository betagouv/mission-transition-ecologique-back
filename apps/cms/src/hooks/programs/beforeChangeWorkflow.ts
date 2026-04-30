import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import {
  WorkflowTransitionPolicy,
  type WorkflowStatus,
} from '@/services/workflow/WorkflowTransitionPolicy'
import { WorkflowAutomation } from '@/services/workflow/WorkflowAutomation'
import type { UserRoleValue } from '@/utils/user/UserRole'

export const beforeChangeWorkflow: CollectionBeforeChangeHook = ({
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

  // Auto-transition: editing a `publie` or `en-relecture` document and clicking
  // "Save Draft" implicitly moves it to `en-cours-modification`.
  if (
    (previousStatus === 'publie' || previousStatus === 'en-relecture') &&
    data._status === 'draft' &&
    (!data.workflowStatus || data.workflowStatus === previousStatus)
  ) {
    data.workflowStatus = 'en-cours-modification'
  }

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

  if (WorkflowTransitionPolicy.requiresReplacement(nextStatusInput) && !data.replacedBy) {
    throw new APIError(
      'Un programme remplaçant doit être renseigné (champ "Remplacé par") pour passer à l’état "Remplacé".',
      400,
    )
  }

  let resolvedStatus: WorkflowStatus = nextStatusInput
  if (nextStatusInput === 'en-cours-publication') {
    const auto = WorkflowAutomation.runPublishingPipeline({
      payload: req.payload,
      programId: originalDoc?.id as string | number,
      validityStart: (data.validityStart ?? originalDoc?.validityStart ?? null) as Date | string | null,
    })
    if (auto !== null) resolvedStatus = auto
  }

  data.workflowStatus = resolvedStatus
  data._status = resolvedStatus === 'publie' ? 'published' : 'draft'

  const historyEntry = {
    from: previousStatus,
    to: resolvedStatus,
    changedBy: req.user?.id,
    changedAt: new Date().toISOString(),
  }
  data.workflowHistory = [...(originalDoc?.workflowHistory ?? []), historyEntry]

  return data
}
