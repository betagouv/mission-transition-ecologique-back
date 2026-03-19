import type { Access } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

export class AuthAccessPolicy {
  static isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

  static isSuperAdmin: Access = ({ req: { user } }) => UserRole.isSuperAdmin(user)

  static isAdminOrAbove: Access = ({ req: { user } }) => UserRole.isAdminAide(user)
}
