import type { CollectionConfig } from 'payload'
import { assignAdemeThemeDisplayName } from '@/hooks/ademeThemes/assignAdemeThemeDisplayName'
import { AdemeThemeAccessPolicy } from '@/services/access/AdemeThemeAccessPolicy'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

/**
 * ADEME theme referential (`ademe_themes.json` upstream): roots and their
 * sub-themes, upserted by code at each sync (`AdemeThemesSync`). Programs point
 * at it through `ademeThemes`, the themes AGIR reads.
 */
export const AdemeThemes: CollectionConfig = {
  slug: 'ademe-themes',
  labels: {
    singular: 'Thématique ADEME',
    plural: 'Thématiques ADEME',
  },
  access: {
    read: AdemeThemeAccessPolicy.read,
    create: AdemeThemeAccessPolicy.create,
    update: AdemeThemeAccessPolicy.update,
    delete: AdemeThemeAccessPolicy.delete,
  },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['code', 'label', 'parent'],
    hidden: ({ user }) => !UserRole.isAdmin(user as unknown as { role: UserRoleValue } | null),
    description: "Référentiel synchronisé chaque jour depuis l'amont : une modification faite ici sera écrasée.",
  },
  defaultSort: 'code',
  hooks: {
    beforeChange: [assignAdemeThemeDisplayName],
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      label: 'Code',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Code du référentiel ADEME : « 19 » pour une thématique, « 19_03 » pour une sous-thématique.' },
    },
    {
      name: 'label',
      type: 'text',
      label: 'Libellé',
      required: true,
    },
    {
      name: 'displayName',
      type: 'text',
      label: 'Nom affiché',
      admin: {
        readOnly: true,
        description: 'Calculé automatiquement : le code suivi du libellé, par exemple « 19_03 · Eau ».',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      label: 'Thématique parente',
      relationTo: 'ademe-themes',
      admin: { description: 'Vide pour une thématique racine.' },
    },
  ],
}
