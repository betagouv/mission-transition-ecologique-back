import type { UserRoleValue } from '@/utils/user/UserRole'
import { UserRole } from '@/utils/user/UserRole'

/** Workflow status values as named constants — the single source of truth. */
export const WORKFLOW_STATUS = {
  enCreation: 'en-creation',
  enRelecture: 'en-relecture',
  enCoursPublication: 'en-cours-publication',
  publie: 'publie',
  enCoursModification: 'en-cours-modification',
  importe: 'importe',
  annule: 'annule',
  archive: 'archive',
  remplace: 'remplace',
} as const

export type WorkflowStatus = (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS]

export type { UserRoleValue as UserRole }

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  'en-creation': 'En création',
  'en-relecture': 'En relecture',
  'en-cours-publication': 'En cours de publication',
  publie: 'Publié',
  'en-cours-modification': 'En cours de modification',
  importe: 'Importé',
  annule: 'Supprimé',
  archive: 'Archivé',
  remplace: 'Remplacé',
}

export const TRANSITION_LABELS: Partial<Record<WorkflowStatus, string>> = {
  'en-relecture': 'Demander la relecture',
  'en-cours-publication': 'Publier',
  publie: 'Publier',
  'en-cours-modification': 'Modifier',
  annule: 'Supprimer',
  archive: 'Archiver',
  remplace: 'Remplacer',
}

export const FINAL_STATUSES: ReadonlySet<WorkflowStatus> = new Set([
  'annule',
  'archive',
  'remplace',
])

/** Collections whose documents follow a workflow. */
export type WorkflowCollection = 'programs' | 'projects'

type TransitionTable = Partial<Record<WorkflowStatus, Partial<Record<UserRoleValue, WorkflowStatus[]>>>>

const PROGRAM_TRANSITIONS: TransitionTable = {
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

/**
 * Projects are written by admins only, without review: same statuses and same
 * vocabulary as the programs, restricted to the ones a project goes through.
 */
const PROJECT_TRANSITIONS: TransitionTable = {
  'en-creation': {
    [UserRole.ADMIN]: ['publie', 'annule'],
  },
  publie: {
    [UserRole.ADMIN]: ['en-cours-modification', 'remplace', 'annule'],
  },
  'en-cours-modification': {
    [UserRole.ADMIN]: ['publie', 'annule'],
  },
  annule: {},
  remplace: {},
}

const TRANSITIONS: Record<WorkflowCollection, TransitionTable> = {
  programs: PROGRAM_TRANSITIONS,
  projects: PROJECT_TRANSITIONS,
}

/** `collection` defaults to the programs, the first collection to follow a workflow. */
export class WorkflowTransitionPolicy {
  static isWorkflowCollection(slug: string | undefined): slug is WorkflowCollection {
    return slug !== undefined && slug in TRANSITIONS
  }

  /** Statuses a document of the collection can be in, in workflow order. */
  static statusesOf(collection: WorkflowCollection): WorkflowStatus[] {
    return Object.keys(TRANSITIONS[collection]) as WorkflowStatus[]
  }

  static canTransition(
    from: WorkflowStatus,
    to: WorkflowStatus,
    role: UserRoleValue,
    collection: WorkflowCollection = 'programs',
  ): boolean {
    if (UserRole.isSuperAdmin({ role })) return WorkflowTransitionPolicy.statusesOf(collection).includes(to)
    return TRANSITIONS[collection][from]?.[role]?.includes(to) ?? false
  }

  static getAllowedTransitions(
    from: WorkflowStatus,
    role: UserRoleValue,
    collection: WorkflowCollection = 'programs',
  ): WorkflowStatus[] {
    if (UserRole.isSuperAdmin({ role })) {
      return WorkflowTransitionPolicy.statusesOf(collection).filter((status) => status !== from)
    }
    return TRANSITIONS[collection][from]?.[role] ?? []
  }

  static isFinal(status: WorkflowStatus): boolean {
    return FINAL_STATUSES.has(status)
  }

  static requiresReplacement(status: WorkflowStatus): boolean {
    return status === 'remplace'
  }
}
