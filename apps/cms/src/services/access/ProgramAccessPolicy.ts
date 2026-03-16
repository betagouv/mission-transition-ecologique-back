import type { Access, AccessResult } from 'payload'

export class ProgramAccessPolicy {
  static read: Access = ({ req: { user } }): AccessResult => {
    if (!user) return false

    if (user.role === 'contributeur') {
      return { assignedContributors: { contains: user.id } }
    }

    return true
  }

  static create: Access = ({ req: { user } }) => {
    if (!user) return false
    return user.role !== 'observateur'
  }

  static update: Access = ({ req: { user } }): AccessResult => {
    if (!user) return false

    if (user.role === 'super-admin') return true

    if (user.role === 'administrateur-aide') {
      const operatorId =
        typeof user.operator === 'object' && user.operator !== null
          ? (user.operator as { id: number }).id
          : (user.operator as number | null | undefined)
      if (!operatorId) return false
      return { operator: { equals: operatorId } }
    }

    if (user.role === 'contributeur') {
      return { assignedContributors: { contains: user.id } }
    }

    return false
  }

  static delete: Access = ({ req: { user } }) => user?.role === 'super-admin'
}
