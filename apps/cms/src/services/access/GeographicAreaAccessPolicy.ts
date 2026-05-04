import type { Access } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

export class GeographicAreaAccessPolicy {
  static read: Access = ({ req: { user } }) => Boolean(user)

  static create: Access = ({ req: { user } }) => UserRole.isSuperAdmin(user)

  static update: Access = ({ req: { user } }) => UserRole.isSuperAdmin(user)

  static delete: Access = ({ req: { user } }) => UserRole.isSuperAdmin(user)
}
