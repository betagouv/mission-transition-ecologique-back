import type { Access, AccessResult } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

export class ProgramAccessPolicy {
  static read: Access = ({ req: { user } }): AccessResult => {
    if (!user) return false

    if (UserRole.isAdmin(user)) return true

    if (UserRole.isCreator(user)) {
      const operatorId = ProgramAccessPolicy.resolveOperatorId(user)
      if (operatorId) return { operator: { equals: operatorId } }
      return { assignedContributors: { contains: user.id } }
    }

    return false
  }

  static create: Access = ({ req: { user } }) => {
    return UserRole.isCreator(user)
  }

  static update: Access = ({ req: { user } }): AccessResult => {
    if (!user) return false

    if (UserRole.isAdmin(user)) return true

    if (UserRole.isCreator(user)) {
      return { assignedContributors: { contains: user.id } }
    }

    return false
  }

  static delete: Access = ({ req: { user } }) => UserRole.isAdmin(user)

  private static resolveOperatorId(user: {
    operator?: unknown
  }): number | undefined {
    const op = user.operator
    if (typeof op === 'object' && op !== null && 'id' in op) {
      return (op as { id: number }).id
    }
    if (typeof op === 'number') return op
    return undefined
  }
}
