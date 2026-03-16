import type { Access } from 'payload'

export class OperatorAccessPolicy {
  static read: Access = ({ req: { user } }) => Boolean(user)

  static update: Access = ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'super-admin') return true

    if (user.role === 'administrateur-aide') {
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
