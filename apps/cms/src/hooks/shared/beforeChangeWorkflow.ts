import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import {
  WorkflowTransitionPolicy,
  type WorkflowCollection,
  type WorkflowStatus,
} from '@/services/workflow/WorkflowTransitionPolicy'
import { WorkflowAutomation } from '@/services/workflow/WorkflowAutomation'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import type { UserRoleValue } from '@/utils/user/UserRole'

/**
 * Workflow of a collection (`Programs`, `Projects`): `workflowStatus` is the
 * single status of a document and drives Payload's `_status`. Checks the
 * transition against the collection's table, requires a replacement on
 * `remplace` and appends each transition to `workflowHistory`.
 */
export const beforeChangeWorkflow = (collection: WorkflowCollection): CollectionBeforeChangeHook => ({
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

  // The upstream sync mirrors the source status as is (e.g. archive, or back to
  // publie when a program reappears), outside the editorial transition rules.
  if (!SystemWorkflowContext.isActive(req.context)) {
    const role = req.user?.role as UserRoleValue | undefined
    if (!role) throw new APIError('Utilisateur non authentifié', 401)

    if (!WorkflowTransitionPolicy.canTransition(previousStatus, nextStatusInput, role, collection)) {
      throw new APIError(
        `Transition non autorisée : ${previousStatus} → ${nextStatusInput} pour le rôle ${role}`,
        403,
      )
    }
  }

  // Trim to reject whitespace-only ids that would pass a plain truthiness check
  const replacedBy = typeof data.replacedBy === 'string' ? data.replacedBy.trim() : data.replacedBy
  if (replacedBy !== data.replacedBy) data.replacedBy = replacedBy
  if (WorkflowTransitionPolicy.requiresReplacement(nextStatusInput) && !replacedBy) {
    throw new APIError(
      'Un remplaçant doit être renseigné (champ "Remplacé par") pour passer à l’état "Remplacé".',
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

  // AGIR reads the end date, not the status: an archived aid without one would look active.
  // An end date cleared by this very write counts as missing.
  const validityEnd = data.validityEnd === undefined ? originalDoc?.validityEnd : data.validityEnd
  if (resolvedStatus === 'archive' && !validityEnd) data.validityEnd = new Date().toISOString()

  const historyEntry = {
    from: previousStatus,
    to: resolvedStatus,
    changedBy: req.user?.id,
    changedAt: new Date().toISOString(),
  }
  data.workflowHistory = [...(originalDoc?.workflowHistory ?? []), historyEntry]

  return data
}
