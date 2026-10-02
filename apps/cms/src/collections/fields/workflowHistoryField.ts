import type { Field } from 'payload'

/**
 * Transitions appended by `beforeChangeWorkflow`, shared by the collections that
 * follow a workflow. Hidden from the form (ticket #6, point 10): the data stays
 * available in the API and in the version snapshots.
 */
export const workflowHistoryField: Field = {
  name: 'workflowHistory',
  type: 'array',
  label: 'Historique des transitions',
  disableDuplicate: true,
  admin: {
    hidden: true,
    readOnly: true,
    description: 'Historique automatique des changements de statut.',
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      label: 'Depuis',
      admin: { readOnly: true },
    },
    { name: 'to', type: 'text', label: 'Vers', admin: { readOnly: true } },
    {
      name: 'changedBy',
      type: 'relationship',
      label: 'Par',
      relationTo: 'users',
      admin: { readOnly: true },
    },
    {
      name: 'changedAt',
      type: 'date',
      label: 'Le',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
}
