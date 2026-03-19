import type { Access, AccessResult } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

export class ProgramAccessPolicy {
  static read: Access = ({ req: { user } }): AccessResult => {
    if (!user) return false

    if (UserRole.isAdminAide(user)) return true

    if (UserRole.isContributeur(user)) {
      return { assignedContributors: { contains: user.id } };
    }

    return true
  }

  static create: Access = ({ req: { user } }) => {
    if (!user) return false
    return UserRole.isContributeur(user)
  }

  static update: Access = ({ req: { user } }): AccessResult => {
    if (!user) return false

    if (UserRole.isSuperAdmin(user)) return true;

    if (UserRole.isAdminAide(user)) {
      const operatorId =
        typeof user.operator === 'object' && user.operator !== null
          ? (user.operator as { id: number }).id
          : (user.operator as number | null | undefined);
      if (!operatorId) return false;
      return { operator: { equals: operatorId } };
    }

    if (UserRole.isContributeur(user)) {
      return { assignedContributors: { contains: user.id } }
    }

    return false
  }

  static delete: Access = ({ req: { user } }) => UserRole.isSuperAdmin(user)
}
