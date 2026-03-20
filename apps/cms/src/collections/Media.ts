import type { CollectionConfig } from 'payload'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    hidden: ({ user }) => !UserRole.isSuperAdmin(user as unknown as { role: UserRoleValue } | null),
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
