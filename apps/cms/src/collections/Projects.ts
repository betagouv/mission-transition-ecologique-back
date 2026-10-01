import type { CollectionConfig } from 'payload'
import type { MediaCategory } from '@/constants/mediaCategoryOptions'

import { NAF_SECTIONS_OPTIONS } from '@/constants/nafSectionsOptions'
import { THEMES_OPTIONS } from '@/constants/themesOptions'
import { removeProjectCanonicalOnDelete } from '@/hooks/projects/removeProjectCanonicalOnDelete'
import { syncProjectCanonicalOnChange } from '@/hooks/projects/syncProjectCanonicalOnChange'
import { assignCanonicalId } from '@/hooks/shared/assignCanonicalId'
import { assignCopySlug } from '@/hooks/shared/assignCopySlug'
import { assignCopyTitle } from '@/hooks/shared/assignCopyTitle'
import { duplicateAsDraft } from '@/hooks/shared/duplicateAsDraft'
import { IntegerValidator } from '@/utils/IntegerValidator'
import { NafCodeValidator } from '@/utils/NafCodeValidator'
import { RequiredRichTextValidator } from '@/utils/RequiredRichTextValidator'
import { RequiredTextValidator } from '@/utils/RequiredTextValidator'
import { SlugValidator } from '@/utils/SlugValidator'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole';

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: {
    singular: 'Projet',
    plural: 'Projets',
  },
  admin: {
    useAsTitle: 'title',
    hidden: ({ user }) => !UserRole.isAdmin(user as unknown as { role: UserRoleValue }),
  },
  hooks: {
    beforeOperation: [duplicateAsDraft],
    beforeChange: [assignCanonicalId],
    afterChange: [syncProjectCanonicalOnChange],
    afterDelete: [removeProjectCanonicalOnDelete],
  },
  versions: {
    drafts: true,
  },
  fields: [
    // --- Identity ---
    {
      // Machine identity carried into the pivot format, same rules as
      // `Programs.canonicalId`: set by the assignCanonicalId hook, locked
      // through the UI and the API, written only by trusted server-side code.
      name: 'canonicalId',
      type: 'text',
      unique: true,
      index: true,
      // A copy gets its own id: Payload would otherwise duplicate it as "<id> - Copy".
      disableDuplicate: true,
      admin: { hidden: true, readOnly: true },
      access: {
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Identifiant',
      required: true,
      unique: true,
      validate: SlugValidator.validate,
      hooks: { beforeDuplicate: [assignCopySlug] },
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
      validate: RequiredTextValidator.text,
      hooks: { beforeDuplicate: [assignCopyTitle] },
    },
    {
      name: 'nameTag',
      type: 'text',
      label: 'Nom court',
      required: true,
      validate: RequiredTextValidator.text,
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      label: 'Description courte',
      required: true,
      validate: RequiredTextValidator.textarea,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Image',
      filterOptions: { category: { equals: 'project-image' satisfies MediaCategory } },
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
      validate: RequiredRichTextValidator.validate,
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
    {
      name: 'titleFaq',
      type: 'text',
      label: 'Titre de la FAQ',
    },
    {
      name: 'faqs',
      type: 'array',
      label: 'Questions fréquentes',
      labels: {
        singular: 'Question',
        plural: 'Questions',
      },
      fields: [
        {
          name: 'question',
          type: 'text',
          label: 'Question',
          required: true,
          validate: RequiredTextValidator.text,
        },
        {
          name: 'answer',
          type: 'richText',
          label: 'Réponse',
          required: true,
          validate: RequiredRichTextValidator.validate,
        },
      ],
    },

    // --- Themes ---
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
      options: [...NAF_SECTIONS_OPTIONS],
    },
    {
      name: 'highlightPriority',
      type: 'number',
      label: 'Priorité de mise en avant',
      min: 0,
      validate: IntegerValidator.nonNegative,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'defaultPriority',
      type: 'number',
      label: 'Priorité par défaut',
      min: 0,
      validate: IntegerValidator.nonNegative,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'sectorPriorities',
      type: 'array',
      label: 'Priorités par secteur',
      labels: {
        singular: 'Priorité par secteur',
        plural: 'Priorités par secteur',
      },
      fields: [
        {
          name: 'nafCode',
          type: 'text',
          label: 'Secteur',
          required: true,
          validate: NafCodeValidator.validate,
          admin: {
            description: 'Section (C) ou code NAF (55, 55.3)',
          },
        },
        {
          name: 'priority',
          type: 'number',
          label: 'Priorité',
          required: true,
          min: 0,
          validate: IntegerValidator.nonNegative,
        },
      ],
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
