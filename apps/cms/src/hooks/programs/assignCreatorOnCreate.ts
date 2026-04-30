import type { CollectionBeforeChangeHook } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

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

  return data
}
