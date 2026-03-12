import type { CollectionConfig } from 'payload'

export const Operators: CollectionConfig = {
  slug: 'operators',
  labels: {
    singular: 'Opérateur',
    plural: 'Opérateurs',
  },
  admin: {
    useAsTitle: 'name',
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
