export class UserRole {
  static readonly SUPER_ADMIN = 'super-admin' as const
  static readonly ADMIN = 'admin' as const
  static readonly CREATOR = 'creator' as const

  static readonly options = [
    { label: 'Super Admin', value: UserRole.SUPER_ADMIN },
    { label: 'Admin', value: UserRole.ADMIN },
    { label: 'Créateur', value: UserRole.CREATOR },
  ] as const

  private static readonly HIERARCHY: UserRoleValue[] = [
    UserRole.CREATOR,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
  ]

  static isAtLeast(role: UserRoleValue, minimum: UserRoleValue): boolean {
    return UserRole.HIERARCHY.indexOf(role) >= UserRole.HIERARCHY.indexOf(minimum)
  }

  static isSuperAdmin(user: { role: UserRoleValue } | null | undefined): boolean {
    return user != null && UserRole.isAtLeast(user.role, UserRole.SUPER_ADMIN)
  }

  static isAdmin(user: { role: UserRoleValue } | null | undefined): boolean {
    return user != null && UserRole.isAtLeast(user.role, UserRole.ADMIN)
  }

  static isCreator(user: { role: UserRoleValue } | null | undefined): boolean {
    return user != null && UserRole.isAtLeast(user.role, UserRole.CREATOR)
  }
}

export type UserRoleValue =
  | typeof UserRole.SUPER_ADMIN
  | typeof UserRole.ADMIN
  | typeof UserRole.CREATOR
