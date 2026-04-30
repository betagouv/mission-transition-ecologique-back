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

const ALLOWED_TRANSITIONS: Record<WorkflowStatus, Partial<Record<UserRoleValue, WorkflowStatus[]>>> = {
  'en-creation': {
    [UserRole.CREATOR]: ['en-relecture', 'annule'],
    [UserRole.ADMIN]: ['en-relecture', 'annule'],
  },
  'en-relecture': {
    [UserRole.CREATOR]: ['en-cours-modification'],
    [UserRole.ADMIN]: ['en-cours-publication', 'en-cours-modification', 'annule'],
  },
  'en-cours-publication': {
    [UserRole.ADMIN]: ['annule'],
  },
  publie: {
    [UserRole.ADMIN]: ['en-cours-modification', 'archive', 'remplace'],
  },
  'en-cours-modification': {
    [UserRole.CREATOR]: ['en-relecture'],
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
        'en-creation',
        'en-relecture',
        'en-cours-publication',
        'publie',
        'en-cours-modification',
        'importe',
        'annule',
        'archive',
        'remplace',
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
