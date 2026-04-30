import type { Access, AccessResult } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

export class ProgramAccessPolicy {
  static read: Access = ({ req: { user } }): AccessResult => {
    if (!user) return false

    if (UserRole.isAdmin(user)) return true

    if (UserRole.isCreator(user)) {
      const operatorId = UserRole.getOperatorId(user)
      if (operatorId) {
        return {
          or: [
            { operator: { equals: operatorId } },
            { assignedContributors: { contains: user.id } },
          ],
        }
      }
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
}
