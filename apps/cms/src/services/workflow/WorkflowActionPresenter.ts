import {
  WorkflowTransitionPolicy,
  WORKFLOW_STATUS,
  TRANSITION_LABELS,
  WORKFLOW_STATUS_LABELS,
  type WorkflowStatus,
} from '@/services/workflow/WorkflowTransitionPolicy'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

/** Visual intent of an action button, mapped to a Payload `buttonStyle`. */
export type WorkflowActionVariant = 'primary' | 'secondary' | 'danger'

/** Where the action is surfaced: the main controls bar or the "⋮" overflow menu. */
export type WorkflowActionPlacement = 'bar' | 'menu'

export type WorkflowAction =
  | {
      key: 'save-draft'
      kind: 'save-draft'
      label: string
      variant: WorkflowActionVariant
      placement: WorkflowActionPlacement
    }
  | {
      key: WorkflowStatus
      kind: 'transition'
      label: string
      to: WorkflowStatus
      requiresReplacement: boolean
      variant: WorkflowActionVariant
      placement: WorkflowActionPlacement
      /** Whether the transition must only fire on a fully valid document. */
      validate: boolean
    }

/** States the document can still be edited and saved as a draft from. */
const DRAFT_EDITABLE_STATUSES: ReadonlySet<WorkflowStatus> = new Set([
  WORKFLOW_STATUS.enCreation,
  WORKFLOW_STATUS.enCoursModification,
  WORKFLOW_STATUS.importe,
])

/** Transitions that may only happen on a fully valid document. */
const VALIDATED_TRANSITIONS: ReadonlySet<WorkflowStatus> = new Set([
  WORKFLOW_STATUS.enRelecture,
  WORKFLOW_STATUS.enCoursPublication,
])

/**
 * Turns the abstract transitions allowed by {@link WorkflowTransitionPolicy} into
 * the explicit, context-labelled buttons rendered by `WorkflowActionBar` and the
 * overflow-menu items rendered by `WorkflowEditMenuItems`.
 *
 * Pure logic (no framework deps) so it stays shared between client and server.
 */
export class WorkflowActionPresenter {
  static getActions(currentStatus: WorkflowStatus, role: UserRoleValue): WorkflowAction[] {
    const actions: WorkflowAction[] = []

    if (DRAFT_EDITABLE_STATUSES.has(currentStatus)) {
      actions.push({
        key: 'save-draft',
        kind: 'save-draft',
        label: 'Enregistrer le brouillon',
        variant: 'secondary',
        placement: 'bar',
      })
    }

    const transitions = WorkflowTransitionPolicy.getAllowedTransitions(currentStatus, role)

    // `annule` ("Supprimer") always sits last as the destructive action.
    const ordered = [...transitions].sort((a, b) => {
      if (a === WORKFLOW_STATUS.annule) return 1
      if (b === WORKFLOW_STATUS.annule) return -1
      return 0
    })

    for (const to of ordered) {
      actions.push({
        key: to,
        kind: 'transition',
        label: WorkflowActionPresenter.labelFor(currentStatus, to, role),
        to,
        requiresReplacement: WorkflowTransitionPolicy.requiresReplacement(to),
        variant: WorkflowActionPresenter.variantFor(to),
        placement: WorkflowActionPresenter.placementFor(to),
        validate: VALIDATED_TRANSITIONS.has(to),
      })
    }

    return actions
  }

  private static labelFor(
    from: WorkflowStatus,
    to: WorkflowStatus,
    role: UserRoleValue,
  ): string {
    // Going back to "en cours de modification" reads differently depending on
    // who triggers it and from where (issue #6, points 14 & 17).
    if (to === WORKFLOW_STATUS.enCoursModification && from === WORKFLOW_STATUS.enRelecture) {
      return UserRole.isAdmin({ role })
        ? 'Demander des corrections'
        : 'Annuler la demande de relecture'
    }

    return TRANSITION_LABELS[to] ?? WORKFLOW_STATUS_LABELS[to]
  }

  private static variantFor(to: WorkflowStatus): WorkflowActionVariant {
    if (to === WORKFLOW_STATUS.annule) return 'danger'
    if (to === WORKFLOW_STATUS.enRelecture || to === WORKFLOW_STATUS.enCoursPublication) {
      return 'primary'
    }
    return 'secondary'
  }

  // "Supprimer" (annule) lives in the "⋮" overflow menu, next to Duplicate;
  // every other action stays on the main controls bar.
  private static placementFor(to: WorkflowStatus): WorkflowActionPlacement {
    return to === WORKFLOW_STATUS.annule ? 'menu' : 'bar'
  }
}
