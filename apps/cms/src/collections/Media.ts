import type { CollectionConfig } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    hidden: ({ user }) => user?.role === UserRole.CONTRIBUTEUR,
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
