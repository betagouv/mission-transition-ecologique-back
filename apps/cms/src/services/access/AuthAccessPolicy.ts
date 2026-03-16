import type { Access } from 'payload'

export class AuthAccessPolicy {
  static isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

  static isSuperAdmin: Access = ({ req: { user } }) => user?.role === 'super-admin'

  static isAdminOrAbove: Access = ({ req: { user } }) =>
    user?.role === 'super-admin' || user?.role === 'administrateur-aide'
}
