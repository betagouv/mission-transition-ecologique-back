import type { CollectionConfig } from 'payload'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    hidden: ({ user }) =>
      !UserRole.isAdmin(user as unknown as { role: UserRoleValue }),
  },
  auth: true,
  fields: [
    // Email added by default
    {
      name: 'role',
      type: 'select',
      label: 'Rôle',
      required: true,
      defaultValue: UserRole.CREATOR,
      options: [...UserRole.options],
    },
    {
      name: 'operator',
      type: 'relationship',
      label: 'Opérateur',
      relationTo: 'operators',
      admin: {
        condition: (data) =>
          !UserRole.isAdmin(data as unknown as { role: UserRoleValue }),
        description: 'Opérateur auquel cet utilisateur est rattaché.',
      },
    },
    {
      name: 'region',
      type: 'text',
      label: 'Région',
      admin: {
        condition: (data) =>
          !UserRole.isAdmin(data as unknown as { role: UserRoleValue }),
        description: 'Ex : "Grand Est"',
      },
    },
    {
      name: 'team',
      type: 'text',
      label: 'Équipe',
      admin: {
        condition: (data) =>
          !UserRole.isAdmin(data as unknown as { role: UserRoleValue }),
        description: 'Ex : "CCI Grand Est"',
      },
    },
  ],
};
