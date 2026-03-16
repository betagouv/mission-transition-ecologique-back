import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    // Email added by default
    {
      name: 'role',
      type: 'select',
      label: 'Rôle',
      required: true,
      defaultValue: 'observateur',
      options: [
        { label: 'Super Admin', value: 'super-admin' },
        { label: 'Administrateur aide', value: 'administrateur-aide' },
        { label: 'Contributeur', value: 'contributeur' },
        { label: 'Observateur', value: 'observateur' },
      ],
    },
    {
      name: 'operator',
      type: 'relationship',
      label: 'Opérateur',
      relationTo: 'operators',
      admin: {
        condition: (data) => data?.role !== 'super-admin',
        description: 'Opérateur auquel cet utilisateur est rattaché.',
      },
    },
    {
      name: 'region',
      type: 'text',
      label: 'Région',
      admin: {
        condition: (data) => data?.role !== 'super-admin',
        description: 'Ex : "Grand Est"',
      },
    },
    {
      name: 'team',
      type: 'text',
      label: 'Équipe',
      admin: {
        condition: (data) => data?.role !== 'super-admin',
        description: 'Ex : "CCI Grand Est"',
      },
    },
  ],
}
