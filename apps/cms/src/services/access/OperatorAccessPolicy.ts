import type { Access } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

export class OperatorAccessPolicy {
  static read: Access = ({ req: { user } }) => Boolean(user)

  static update: Access = ({ req: { user } }) => {
    if (!user) return false
    if (UserRole.isSuperAdmin(user)) return true;

    if (UserRole.isAdminAide(user)) {
      const operatorId =
        typeof user.operator === 'object' && user.operator !== null
          ? user.operator.id
          : user.operator
      if (!operatorId) return false
      return { id: { equals: operatorId } }
    }

    return false
  }
}
