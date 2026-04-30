import type { CollectionConfig } from 'payload'
import { AuthAccessPolicy } from '@/services/access/AuthAccessPolicy'
import { OperatorAccessPolicy } from '@/services/access/OperatorAccessPolicy'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

export const Operators: CollectionConfig = {
  slug: 'operators',
  labels: {
    singular: 'Opérateur',
    plural: 'Opérateurs',
  },
  admin: {
    useAsTitle: 'name',
    hidden: ({ user }) => !UserRole.isAdmin(user as unknown as { role: UserRoleValue } | null),
  },
  access: {
    read: OperatorAccessPolicy.read,
    create: AuthAccessPolicy.isSuperAdmin,
    update: OperatorAccessPolicy.update,
    delete: AuthAccessPolicy.isSuperAdmin,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nom',
      required: true,
      unique: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Identifiant',
      unique: true,
      admin: {
        description: 'Auto-generated from name. Used as a stable identifier.',
      },
    },
    {
      name: 'contactUrl',
      type: 'text',
      label: 'URL de contact',
    },
  ],
}
