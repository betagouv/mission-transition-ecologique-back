import type { CollectionConfig, FieldAccess } from 'payload'
import { AuthAccessPolicy } from '@/services/access/AuthAccessPolicy'
import { assignCommentAuthor } from '@/hooks/reviewComments/assignCommentAuthor'

/**
 * Review comments live in their own collection (one row per comment, linked to
 * a program) rather than as an array on Programs. This lets a reviewer post a
 * comment with a single create call, without updating the program: no workflow
 * transition, no full-form validation, no version churn. Managed entirely from
 * the Programs sidebar (ReviewCommentsThread), so hidden from the admin nav.
 */
export const ReviewComments: CollectionConfig = {
  slug: 'review-comments',
  labels: {
    singular: 'Commentaire de relecture',
    plural: 'Commentaires de relecture',
  },
  admin: {
    hidden: true,
    useAsTitle: 'text',
    defaultColumns: ['text', 'author', 'program', 'createdAt'],
  },
  access: {
    read: AuthAccessPolicy.isAuthenticated,
    create: AuthAccessPolicy.isAuthenticated,
    update: AuthAccessPolicy.isAdmin,
    delete: AuthAccessPolicy.isAdmin,
  },
  hooks: {
    beforeChange: [assignCommentAuthor],
  },
  fields: [
    {
      name: 'program',
      type: 'relationship',
      label: 'Dispositif',
      relationTo: 'programs',
      required: true,
      index: true,
    },
    {
      name: 'text',
      type: 'textarea',
      label: 'Commentaire',
      required: true,
    },
    {
      name: 'author',
      type: 'relationship',
      label: 'Auteur',
      relationTo: 'users',
      admin: { readOnly: true },
      access: {
        update: (() => false) satisfies FieldAccess,
      },
    },
  ],
}
