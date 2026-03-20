import type { CollectionConfig } from 'payload'

import { NAF_SECTIONS_OPTIONS } from '@/constants/nafSectionsOptions'
import { THEMES_OPTIONS } from '@/constants/themesOptions'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole';

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: {
    singular: 'Projet',
    plural: 'Projets',
  },
  admin: {
    useAsTitle: 'title',
    hidden: ({ user }) => !UserRole.isSuperAdmin(user as unknown as { role: UserRoleValue }),
  },
  fields: [
    // --- Identity ---
    {
      name: 'slug',
      type: 'text',
      label: 'Identifiant',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
        description: 'Unique identifier.',
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Titre',
      required: true,
    },
    {
      name: 'nameTag',
      type: 'text',
      label: 'Nom court',
      required: true,
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      label: 'Description courte',
      required: true,
    },
    {
      name: 'image',
      type: 'text',
      label: 'Image',
      admin: {
        description: 'Relative path to image.',
      },
    },

    // --- Content ---
    {
      name: 'titleLongDescription',
      type: 'text',
      label: 'Titre de la description longue',
    },
    {
      name: 'longDescription',
      type: 'richText',
      label: 'Description longue',
      required: true,
    },
    {
      name: 'titleMoreDescription',
      type: 'text',
      label: 'Titre de la description complémentaire',
    },
    {
      name: 'moreDescription',
      type: 'richText',
      label: 'Description complémentaire',
    },

    // --- Thématiques ---
    {
      name: 'mainTheme',
      type: 'select',
      label: 'Thématique principale',
      required: true,
      options: THEMES_OPTIONS,
    },
    {
      name: 'themes',
      type: 'select',
      label: 'Thématiques',
      hasMany: true,
      options: THEMES_OPTIONS,
    },

    // --- Classification ---
    {
      name: 'sectors',
      type: 'select',
      label: "Secteurs d'activité (NAF)",
      hasMany: true,
      options: NAF_SECTIONS_OPTIONS,
    },
    {
      name: 'highlightPriority',
      type: 'number',
      label: 'Priorité de mise en avant',
      admin: {
        position: 'sidebar',
      },
    },

    // --- Relations ---
    {
      name: 'programs',
      type: 'relationship',
      label: 'Programmes associés',
      relationTo: 'programs',
      hasMany: true,
    },
    {
      name: 'titleLinkedProjects',
      type: 'text',
      label: 'Titre des projets liés',
    },
    {
      name: 'descriptionLinkedProjects',
      type: 'textarea',
      label: 'Description des projets liés',
    },
    {
      name: 'linkedProjects',
      type: 'relationship',
      label: 'Projets liés',
      relationTo: 'projects',
      hasMany: true,
    },

    // --- SEO ---
    {
      name: 'metaTitle',
      type: 'text',
      label: 'Titre SEO',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      label: 'Description SEO',
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
