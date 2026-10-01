import type { CollectionConfig } from 'payload';
import { GeographicAreaAccessPolicy } from '@/services/access/GeographicAreaAccessPolicy';
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole';
import { assignDisplayName } from '@/hooks/geographicAreas/assignDisplayName';

export const GeographicAreas: CollectionConfig = {
  slug: 'geographic-areas',
  labels: {
    singular: 'Zone géographique',
    plural: 'Zones géographiques',
  },
  access: {
    read: GeographicAreaAccessPolicy.read,
    create: GeographicAreaAccessPolicy.create,
    update: GeographicAreaAccessPolicy.update,
    delete: GeographicAreaAccessPolicy.delete,
  },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['name', 'coverageType', 'inseeCode', 'isOverseas', 'parentArea'],
    hidden: ({ user }) =>
      !UserRole.isAdmin(user as unknown as { role: UserRoleValue } | null),
  },
  hooks: {
    beforeChange: [assignDisplayName],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nom',
      required: true,
    },
    {
      name: 'displayName',
      type: 'text',
      label: 'Nom affiché',
      admin: {
        readOnly: true,
        description: 'Calculé automatiquement : le nom suivi du niveau, par exemple « Guadeloupe (région) ».',
      },
    },
    {
      name: 'coverageType',
      type: 'select',
      label: 'Couverture géographique',
      required: true,
      options: [
        { label: 'Région', value: 'region' },
        { label: 'Département', value: 'departement' },
        { label: 'Commune', value: 'commune' },
        { label: 'EPCI', value: 'epci' },
        { label: 'Autre', value: 'autre' },
      ],
    },
    {
      name: 'inseeCode',
      type: 'text',
      label: 'Code INSEE',
      admin: {
        description:
          'Code INSEE officiel (ex: "75" pour Paris, "11" pour Île-de-France).',
      },
    },
    {
      name: 'isOverseas',
      type: 'checkbox',
      label: 'DOM-TOM / Outre-mer',
      defaultValue: false,
      admin: {
        description:
          "Cochez si la zone fait partie de l'outre-mer (DROM, COM ou autre collectivité). Permet de distinguer métropole et outre-mer lors de la sélection groupée.",
      },
    },
    {
      name: 'parentArea',
      type: 'relationship',
      label: 'Zone parente',
      relationTo: 'geographic-areas',
      admin: {
        description:
          'Zone englobante du niveau supérieur (une commune appartient à un EPCI qui appartient à un département qui appartient à une région).',
      },
    },
  ],
};
