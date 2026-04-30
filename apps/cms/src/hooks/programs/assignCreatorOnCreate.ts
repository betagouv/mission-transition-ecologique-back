import type { CollectionBeforeChangeHook } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

/**
 * On program creation by a `creator`, wires up the new program to its author:
 *  - adds the user to `assignedContributors` (so they keep edit rights)
 *  - forces `operator` to the user's operator (a creator can only file
 *    programs under their own operator)
 */
export const assignCreatorOnCreate: CollectionBeforeChangeHook = ({
  data,
  req,
  operation,
}) => {
  if (operation !== 'create') return data

  const user = req.user
  if (!user || !UserRole.isCreator(user) || UserRole.isAdmin(user)) return data

  const existing = (data.assignedContributors ?? []) as (string | number)[]
  if (!existing.includes(user.id)) {
    data.assignedContributors = [...existing, user.id]
  }

  const operatorId = UserRole.getOperatorId(user)
  if (operatorId) data.operator = operatorId

  return data
}
