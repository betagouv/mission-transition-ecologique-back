import type { CollectionConfig } from 'payload'

export const Programs: CollectionConfig = {
  slug: 'programs',
  labels: {
    singular: 'Programme',
    plural: 'Programmes',
  },
  admin: {
    useAsTitle: 'title',
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
        description: 'Unique identifier (from JSON "id" field).',
        position: 'sidebar',
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Titre',
      required: true,
    },
    {
      name: 'promise',
      type: 'text',
      label: 'Promesse',
      required: true,
    },
    {
      name: 'aidType',
      type: 'select',
      label: "Type d'aide",
      required: true,
      options: [
        { label: 'Étude', value: 'etude' },
        { label: 'Financement', value: 'financement' },
        { label: 'Formation', value: 'formation' },
        { label: 'Prêt', value: 'pret' },
        { label: 'Avantage fiscal', value: 'avantage-fiscal' },
      ],
    },

    // --- Content ---
    {
      name: 'description',
      type: 'richText',
      label: 'Description',
      required: true,
    },
    {
      name: 'longDescription',
      type: 'richText',
      label: 'Description longue',
    },

    // --- Relations ---
    {
      name: 'operator',
      type: 'relationship',
      label: 'Opérateur principal',
      relationTo: 'operators',
      required: true,
    },
    {
      name: 'otherOperators',
      type: 'relationship',
      label: 'Autres opérateurs',
      relationTo: 'operators',
      hasMany: true,
    },
    {
      name: 'illustration',
      type: 'text',
      label: 'Illustration',
      admin: {
        description: 'Relative path to illustration image (e.g. "images/TEE_energie_verte.webp").',
      },
    },

    // --- Contact & URL ---
    {
      name: 'contactUrl',
      type: 'text',
      label: 'URL de contact',
      required: true,
      admin: {
        description: 'Contact URL or mailto: link.',
      },
    },
    {
      name: 'url',
      type: 'text',
      label: 'URL du programme',
    },

    // --- Validity ---
    {
      name: 'validityStart',
      type: 'date',
      label: 'Début de validité',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'validityEnd',
      type: 'date',
      label: 'Fin de validité',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'temporarilyUnavailable',
      type: 'checkbox',
      label: 'Temporairement indisponible',
      defaultValue: false,
    },

    // --- Financial (conditional by aidType) ---
    {
      name: 'fundingAmount',
      type: 'text',
      label: 'Montant du financement',
      admin: {
        condition: (data) => data?.aidType === 'financement',
        description: 'Montant du financement.',
      },
    },
    {
      name: 'accompanyingCost',
      type: 'text',
      label: "Coût de l'accompagnement",
      admin: {
        condition: (data) => data?.aidType === 'etude',
        description: "Coût de l'accompagnement.",
      },
    },
    {
      name: 'accompanyingDuration',
      type: 'text',
      label: "Durée de l'accompagnement",
      admin: {
        condition: (data) => data?.aidType === 'etude',
        description: "Durée de l'accompagnement.",
      },
    },
    {
      name: 'loanAmount',
      type: 'text',
      label: 'Montant du prêt',
      admin: {
        condition: (data) => data?.aidType === 'pret',
        description: 'Montant du prêt.',
      },
    },
    {
      name: 'loanDuration',
      type: 'text',
      label: 'Durée du prêt',
      admin: {
        condition: (data) => data?.aidType === 'pret',
        description: 'Durée du prêt.',
      },
    },
    {
      name: 'taxBenefitAmount',
      type: 'text',
      label: "Montant de l'avantage fiscal",
      admin: {
        condition: (data) => data?.aidType === 'avantage-fiscal',
        description: "Montant de l'avantage fiscal.",
      },
    },

    // --- Autonomy ---
    {
      name: 'selfActivatable',
      type: 'select',
      label: 'Activable en autonomie',
      options: [
        { label: 'Oui', value: 'oui' },
        { label: 'Non', value: 'non' },
      ],
    },

    // --- Objectives ---
    {
      name: 'objectives',
      type: 'array',
      label: 'Objectifs',
      fields: [
        {
          name: 'description',
          type: 'text',
          label: 'Description',
          required: true,
        },
        {
          name: 'links',
          type: 'array',
          label: 'Liens',
          fields: [
            {
              name: 'url',
              type: 'text',
              label: 'URL',
            },
            {
              name: 'label',
              type: 'text',
              label: 'Libellé',
            },
          ],
        },
      ],
    },

    // --- Eligibility — human-readable text ---
    {
      name: 'eligibilityConditions',
      type: 'group',
      label: "Conditions d'éligibilité",
      fields: [
        {
          name: 'companySize',
          type: 'array',
          label: "Taille de l'entreprise",
          fields: [{ name: 'value', type: 'text', label: 'Valeur', required: true }],
        },
        {
          name: 'geographicArea',
          type: 'array',
          label: 'Zone géographique',
          fields: [{ name: 'value', type: 'text', label: 'Valeur', required: true }],
        },
        {
          name: 'activitySector',
          type: 'array',
          label: "Secteur d'activité",
          fields: [{ name: 'value', type: 'text', label: 'Valeur', required: true }],
        },
        {
          name: 'activityYears',
          type: 'array',
          label: "Années d'activité",
          fields: [{ name: 'value', type: 'text', label: 'Valeur', required: true }],
        },
        {
          name: 'otherCriteria',
          type: 'array',
          label: 'Autres critères',
          fields: [{ name: 'value', type: 'text', label: 'Valeur', required: true }],
        },
      ],
    },

    // --- Eligibility — machine-readable structured data ---
    {
      name: 'eligibilityData',
      type: 'group',
      label: "Données d'éligibilité (structurées)",
      fields: [
        {
          name: 'company',
          type: 'group',
          label: 'Entreprise',
          fields: [
            {
              name: 'allowedNafSections',
              type: 'array',
              label: 'Sections NAF autorisées',
              fields: [{ name: 'value', type: 'text', label: 'Valeur', required: true }],
            },
            {
              name: 'minEmployees',
              type: 'number',
              label: 'Nombre minimum de salariés',
            },
            {
              name: 'maxEmployees',
              type: 'number',
              label: 'Nombre maximum de salariés',
            },
            {
              name: 'excludeMicroentrepreneur',
              type: 'checkbox',
              label: 'Exclure les micro-entrepreneurs',
              defaultValue: false,
            },
          ],
        },
        {
          name: 'validityStart',
          type: 'date',
          label: 'Début de validité',
          admin: {
            date: { pickerAppearance: 'dayOnly' },
          },
        },
        {
          name: 'validityEnd',
          type: 'date',
          label: 'Fin de validité',
          admin: {
            date: { pickerAppearance: 'dayOnly' },
          },
        },
        {
          name: 'priorityObjectives',
          type: 'array',
          label: 'Objectifs prioritaires',
          fields: [{ name: 'value', type: 'text', label: 'Valeur', required: true }],
        },
      ],
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