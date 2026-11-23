import type { Access } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

/** The referential is synced from upstream: only a super admin may touch it by hand. */
export class AdemeThemeAccessPolicy {
  static read: Access = ({ req: { user } }) => Boolean(user)

  static create: Access = ({ req: { user } }) => UserRole.isSuperAdmin(user)

  static update: Access = ({ req: { user } }) => UserRole.isSuperAdmin(user)

  static delete: Access = ({ req: { user } }) => UserRole.isSuperAdmin(user)
}
