import type { Access } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

export class AuthAccessPolicy {
  static isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

  static isSuperAdmin: Access = ({ req: { user } }) => UserRole.isAdmin(user)

  static isAdmin: Access = ({ req: { user } }) => UserRole.isAdmin(user)
}
