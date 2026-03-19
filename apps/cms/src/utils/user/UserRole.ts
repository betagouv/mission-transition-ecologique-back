export class UserRole {
  static readonly SUPER_ADMIN = 'super-admin' as const
  static readonly ADMIN_AIDE = 'administrateur-aide' as const
  static readonly CONTRIBUTEUR = 'contributeur' as const
  static readonly OBSERVATEUR = 'observateur' as const

  static readonly options = [
    { label: 'Super Admin', value: UserRole.SUPER_ADMIN },
    { label: 'Administrateur aide', value: UserRole.ADMIN_AIDE },
    { label: 'Contributeur', value: UserRole.CONTRIBUTEUR },
    { label: 'Observateur', value: UserRole.OBSERVATEUR },
  ] as const

  private static readonly HIERARCHY: UserRoleValue[] = [
    UserRole.OBSERVATEUR,
    UserRole.CONTRIBUTEUR,
    UserRole.ADMIN_AIDE,
    UserRole.SUPER_ADMIN,
  ]

  static isAtLeast(role: UserRoleValue, minimum: UserRoleValue): boolean {
    return UserRole.HIERARCHY.indexOf(role) >= UserRole.HIERARCHY.indexOf(minimum)
  }

  static isSuperAdmin(user: { role: UserRoleValue } | null | undefined): boolean {
    return user != null && UserRole.isAtLeast(user.role, UserRole.SUPER_ADMIN)
  }

  static isAdminAide(user: { role: UserRoleValue } | null | undefined): boolean {
    return user != null && UserRole.isAtLeast(user.role, UserRole.ADMIN_AIDE)
  }

  static isContributeur(user: { role: UserRoleValue } | null | undefined): boolean {
    return user != null && UserRole.isAtLeast(user.role, UserRole.CONTRIBUTEUR)
  }

  static isObservateur(user: { role: UserRoleValue } | null | undefined): boolean {
    return user != null && UserRole.isAtLeast(user.role, UserRole.OBSERVATEUR)
  }
}

export type UserRoleValue =
  | typeof UserRole.SUPER_ADMIN
  | typeof UserRole.ADMIN_AIDE
  | typeof UserRole.CONTRIBUTEUR
  | typeof UserRole.OBSERVATEUR
