import type { UserRoleValue } from '@/utils/user/UserRole'
import { UserRole } from '@/utils/user/UserRole'

export type WorkflowStatus = 'brouillon' | 'en-revision' | 'valide' | 'publie'
export type { UserRoleValue as UserRole }

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
const ALLOWED_TRANSITIONS: Record<WorkflowStatus, Partial<Record<UserRoleValue, WorkflowStatus[]>>> = {
  brouillon: {
    [UserRole.CONTRIBUTEUR]: ['en-revision'],
    [UserRole.ADMIN_AIDE]: ['en-revision'],
  },
  'en-revision': {
    [UserRole.ADMIN_AIDE]: ['valide'],
  },
  valide: {},
  publie: {},
}

export class WorkflowTransitionPolicy {
  static canTransition(from: WorkflowStatus, to: WorkflowStatus, role: UserRoleValue): boolean {
    if (UserRole.isSuperAdmin({ role: role })) return true;
    return ALLOWED_TRANSITIONS[from]?.[role]?.includes(to) ?? false
  }

  /**
   * Returns the list of statuses reachable from `from` for the given role.
   * Super-admin can reach all statuses except the current one.
   */
  static getAllowedTransitions(from: WorkflowStatus, role: UserRoleValue): WorkflowStatus[] {
    const all: WorkflowStatus[] = ['brouillon', 'en-revision', 'valide', 'publie']
    if (UserRole.isSuperAdmin({ role: role }))
      return all.filter((s) => s !== from);
    return ALLOWED_TRANSITIONS[from]?.[role] ?? []
  }
}
