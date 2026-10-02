import type { CollectionConfig } from 'payload'
import { MEDIA_CATEGORY_OPTIONS } from '@/constants/mediaCategoryOptions'
import { AuthAccessPolicy } from '@/services/access/AuthAccessPolicy'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    hidden: ({ user }) => !UserRole.isAdmin(user as unknown as { role: UserRoleValue } | null),
    defaultColumns: ['filename', 'alt', 'category', 'updatedAt'],
    listSearchableFields: ['filename', 'alt'],
  },
  access: {
    read: () => true,
    create: AuthAccessPolicy.isAdmin,
    update: AuthAccessPolicy.isAdmin,
    delete: AuthAccessPolicy.isAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'category',
      type: 'select',
      label: 'Type',
      required: true,
      options: [...MEDIA_CATEGORY_OPTIONS],
    },
    {
      // Upstream path of an imported file, the idempotence key of the seed import;
      // empty for a manual upload. Like Programs.canonicalId, field access denies
      // create/update to every API caller: only overrideAccess writes (seed) set it.
      name: 'sourcePath',
      type: 'text',
      unique: true,
      index: true,
      admin: { hidden: true, readOnly: true },
      access: {
        create: () => false,
        update: () => false,
      },
    },
  ],
  upload: true,
}
