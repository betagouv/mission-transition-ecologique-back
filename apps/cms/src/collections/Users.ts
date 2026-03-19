import type { CollectionConfig } from 'payload'
import { UserRole } from '@/utils/user/UserRole'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    hidden: ({ user }) => user?.role === UserRole.CONTRIBUTEUR,
  },
  auth: true,
  fields: [
    // Email added by default
    {
      name: 'role',
      type: 'select',
      label: 'Rôle',
      required: true,
      defaultValue: UserRole.OBSERVATEUR,
      options: [...UserRole.options],
    },
    {
      name: 'operator',
      type: 'relationship',
      label: 'Opérateur',
      relationTo: 'operators',
      admin: {
        condition: (data) => UserRole.isAdminAide(data?.role),
        description: 'Opérateur auquel cet utilisateur est rattaché.',
      },
    },
    {
      name: 'region',
      type: 'text',
      label: 'Région',
      admin: {
        condition: (data) => UserRole.isAdminAide(data?.role),
        description: 'Ex : "Grand Est"',
      },
    },
    {
      name: 'team',
      type: 'text',
      label: 'Équipe',
      admin: {
        condition: (data) => UserRole.isAdminAide(data?.role),
        description: 'Ex : "CCI Grand Est"',
      },
    },
  ],
}
