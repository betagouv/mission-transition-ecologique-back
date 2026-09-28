import type { CollectionConfig } from 'payload'
import type { MediaCategory } from '@/constants/mediaCategoryOptions'
import { AuthAccessPolicy } from '@/services/access/AuthAccessPolicy'
import { OperatorAccessPolicy } from '@/services/access/OperatorAccessPolicy'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

export const OperatorGroups: CollectionConfig = {
  slug: 'operator-groups',
  labels: {
    singular: "Groupe d'opérateurs",
    plural: "Groupes d'opérateurs",
  },
  admin: {
    useAsTitle: 'name',
    hidden: ({ user }) => !UserRole.isAdmin(user as unknown as { role: UserRoleValue } | null),
  },
  access: {
    read: OperatorAccessPolicy.read,
    create: AuthAccessPolicy.isAdmin,
    update: AuthAccessPolicy.isAdmin,
    delete: AuthAccessPolicy.isAdmin,
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
      required: true,
      unique: true,
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo',
      filterOptions: { category: { equals: 'operator-logo' satisfies MediaCategory } },
      admin: {
        description: "Logo utilisé en secours pour les opérateurs du groupe qui n'ont pas de logo.",
      },
    },
  ],
}
