import type { CollectionConfig, FieldAccess } from 'payload'
import { ProgramAccessPolicy } from '@/services/access/ProgramAccessPolicy'
import { beforeChangeWorkflow } from '@/hooks/programs/beforeChangeWorkflow'
import { assignCreatorOnCreate } from '@/hooks/programs/assignCreatorOnCreate'
import { assignCanonicalId } from '@/hooks/programs/assignCanonicalId'
import { syncCanonicalOnPublish } from '@/hooks/programs/syncCanonicalOnPublish'
import { THEMES_OPTIONS } from '@/constants/themesOptions'
import {
  ACTIVITY_SECTOR_OPTIONS,
  COMPANY_SIZE_OPTIONS,
} from '@/constants/eligibilityOptions'
import {
  CONDITION_TYPE_OPTIONS,
  MODIFIABLE_FIELD_OPTIONS,
} from '@/constants/variantOptions'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

const CONTACT_METHOD_OPTIONS = [
  { label: 'Avec Conseillers-Entreprises (rappel téléphonique)', value: 'advisor' },
  { label: 'Par mail', value: 'email' },
  { label: 'Par lien vers une page contact', value: 'url' },
] as const

const AID_TYPE_OPTIONS = [
  { label: 'Financement', value: 'financement' },
  { label: 'Prêt', value: 'pret' },
  { label: 'Avantage fiscal', value: 'avantage-fiscal' },
  { label: 'Formation', value: 'formation' },
  { label: 'Diagnostic ou étude', value: 'diagnostic-etude' },
] as const

// Modifiable fields whose new value is plain text (the others, operators, use a
// relationship picker into the Operators collection).
const TEXT_VALUE_MODIFICATION_FIELDS = [
  'montant',
  'duree',
  'urlSource',
  'eligibiliteEffectif',
  'autresCriteres',
]

export const Programs: CollectionConfig = {
  slug: 'programs',
  labels: {
    singular: 'Dispositif',
    plural: 'Dispositifs',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: [
      'title',
      'operator',
      'aidType',
      'workflowStatus',
      'updatedAt',
    ],
    components: {
      edit: {
        PublishButton:
          '@/components/programs/WorkflowActionBar#WorkflowActionBar',
        Status: '@/components/programs/WorkflowStatusBadge#WorkflowStatusBadge',
      },
    },
  },
  hooks: {
    beforeChange: [assignCanonicalId, assignCreatorOnCreate, beforeChangeWorkflow],
    afterChange: [syncCanonicalOnPublish],
  },
  access: {
    read: ProgramAccessPolicy.read,
    create: ProgramAccessPolicy.create,
    update: ProgramAccessPolicy.update,
    delete: ProgramAccessPolicy.delete,
  },
  versions: {
    drafts: true,
    maxPerDoc: 100,
  },
  fields: [
    // --- Main ---
    {
      name: 'title',
      type: 'text',
      label: 'Titre',
      required: true,
      admin: {
        description: 'Exemple : Visite Énergie (1 à 4 mots).',
      },
    },
    {
      name: 'operator',
      type: 'relationship',
      label: 'Opérateur principal',
      relationTo: 'operators',
      required: true,
      filterOptions: ({ user }) => {
        if (!user) return true
        if (UserRole.isAdmin(user as { role: UserRoleValue })) return true
        const operatorId = UserRole.getOperatorId(user)
        return operatorId ? { id: { equals: operatorId } } : true
      },
    },
    {
      name: 'otherOperators',
      type: 'relationship',
      label: 'Autres opérateurs',
      relationTo: 'operators',
      hasMany: true,
    },
    {
      name: 'url',
      type: 'text',
      label: 'Lien du dispositif',
      required: true,
      admin: {
        description: 'Exemple : https://...',
      },
    },
    {
      name: 'aidType',
      type: 'select',
      label: 'Type de dispositif',
      required: true,
      options: [...AID_TYPE_OPTIONS],
    },
    {
      name: 'fundingAmount',
      type: 'text',
      label: 'Montant du financement',
      admin: {
        condition: (data) => data?.aidType === 'financement',
        description:
          "Exemple : Jusqu'à 35% des dépenses, dans un maximum de 50 000 €.",
      },
    },
    {
      name: 'loanAmount',
      type: 'text',
      label: 'Montant du prêt',
      admin: {
        condition: (data) => data?.aidType === 'pret',
        description: 'Exemple : De 10 000 € à 75 000 €.',
      },
    },
    {
      name: 'taxBenefitAmount',
      type: 'text',
      label: "Montant de l'avantage fiscal",
      admin: {
        condition: (data) => data?.aidType === 'avantage-fiscal',
        description: "Crédit d'impôt entre 20 à 60% selon localisation.",
      },
    },
    {
      name: 'formationRemainingCost',
      type: 'text',
      label: 'Coût restant à charge',
      admin: {
        condition: (data) => data?.aidType === 'formation',
        description: 'Exemple : 0 €.',
      },
    },
    {
      name: 'formationDuration',
      type: 'text',
      label: 'Durée de la formation',
      admin: {
        condition: (data) => data?.aidType === 'formation',
        description: 'Exemple : 3 heures.',
      },
    },
    {
      name: 'studyRemainingCost',
      type: 'text',
      label: 'Coût restant à charge',
      admin: {
        condition: (data) => data?.aidType === 'diagnostic-etude',
        description:
          "Exemple : entre 5 000€ et 7 000€ HT selon la taille d'entreprise.",
      },
    },
    {
      name: 'studyDuration',
      type: 'text',
      label: "Durée du diagnostic ou de l'étude",
      admin: {
        condition: (data) => data?.aidType === 'diagnostic-etude',
        description:
          'Exemple : 18 jours de prestation répartis sur 6 à 8 mois.',
      },
    },
    {
      name: 'promise',
      type: 'text',
      label: 'Promesse',
      required: true,
      admin: {
        description:
          'Exemple : Réduisez et valorisez les déchets de votre entreprise (6 à 16 mots).',
      },
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Description',
      required: true,
      admin: {
        description:
          "Exemple : Bénéficiez de l'accompagnement d'un expert CCI pour vous aider à évaluer la vulnérabilité climatique de votre entreprise (30 à 60 mots).",
      },
    },

    // --- How to benefit ---
    {
      type: 'collapsible',
      label: 'Étapes pour en bénéficier',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'steps',
          type: 'array',
          label: '',
          labels: { singular: 'une étape', plural: 'étapes' },
          admin: {
            components: {
              RowLabel: {
                path: '@/components/programs/NumberedRowLabel#NumberedRowLabel',
                clientProps: { singular: 'Étape' },
              },
            },
          },
          defaultValue: [
            { description: '', links: [{ url: '', linkLabel: '' }] },
            { description: '', links: [{ url: '', linkLabel: '' }] },
            { description: '' },
          ],
          fields: [
            {
              name: 'description',
              type: 'text',
              label: "Description de l'étape",
              required: true,
              admin: {
                description:
                  "Une étape courte et actionnable, dans l'ordre chronologique. Ex. étape 1 : « Consultez le document pour vérifier l'éligibilité de votre projet » — étape 2 : « Déposez votre demande de financement via le formulaire » — étape 3 : « Recevez votre aide financière et réalisez vos travaux ».",
              },
            },
            {
              name: 'links',
              type: 'array',
              label: '',
              labels: { singular: 'un lien', plural: 'liens' },
              admin: {
                components: {
                  RowLabel: {
                    path: '@/components/programs/NumberedRowLabel#NumberedRowLabel',
                    clientProps: { singular: 'Lien' },
                  },
                },
              },
              fields: [
                {
                  name: 'url',
                  type: 'text',
                  label: 'URL',
                  admin: {
                    description: 'Lien de votre document au format https://...',
                  },
                },
                {
                  name: 'linkLabel',
                  type: 'text',
                  label: 'Titre du lien',
                  admin: {
                    description: 'Exemple : Document, Formulaire.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },

    // --- Contact ---
    {
      type: 'collapsible',
      label: 'Mode de contact en cas de question',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'contactMethods',
          type: 'select',
          label: 'Mode de contact',
          hasMany: true,
          options: [...CONTACT_METHOD_OPTIONS],
        },
        {
          name: 'contactEmail',
          type: 'email',
          label: 'Adresse mail du conseiller',
          admin: {
            condition: (data) =>
              Array.isArray(data?.contactMethods) &&
              (data.contactMethods as string[]).includes('email'),
          },
        },
        {
          name: 'contactPageUrl',
          type: 'text',
          label: 'URL',
          admin: {
            condition: (data) =>
              Array.isArray(data?.contactMethods) &&
              (data.contactMethods as string[]).includes('url'),
            description: 'Exemple : https://...',
          },
        },
        {
          name: 'validityStart',
          type: 'date',
          label: 'Date de début de validité',
          admin: { date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'validityEnd',
          type: 'date',
          label: 'Date de fin de validité',
          admin: { date: { pickerAppearance: 'dayOnly' } },
        },
      ],
    },

    // --- Project ---
    {
      type: 'collapsible',
      label: 'Projet',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'themes',
          type: 'select',
          label: 'Thématique',
          hasMany: true,
          options: THEMES_OPTIONS,
          admin: {
            description: 'Sert à filtrer les projets associables ci-dessous.',
          },
        },
        {
          name: 'linkedProjectsCounter',
          type: 'ui',
          label: '',
          admin: {
            components: {
              Field:
                '@/components/programs/LinkedProjectsCounter#LinkedProjectsCounter',
            },
          },
        },
        {
          name: 'linkedProjects',
          type: 'relationship',
          label: 'Projet(s) lié(s) au dispositif',
          relationTo: 'projects',
          hasMany: true,
        },
      ],
    },

    // --- Eligibility ---
    {
      type: 'collapsible',
      label: 'Éligibilité',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'companySizes',
          type: 'select',
          label: "Taille d'entreprise",
          hasMany: true,
          options: [...COMPANY_SIZE_OPTIONS],
          defaultValue: [
            '0-9',
            '10-19',
            '20-49',
            '50-249',
            '250-499',
            '500-4999',
            '5000+',
          ],
        },
        {
          name: 'companySizeOther',
          type: 'text',
          label: 'Éligibilité taille spécifique',
          admin: {
            condition: (data) =>
              Array.isArray(data?.companySizes) &&
              (data.companySizes as string[]).includes('other'),
            description: 'Exemple : PME au sens européen.',
          },
        },
        {
          name: 'geographicAreas',
          type: 'relationship',
          label: "Zone géographique couverte par l'aide",
          relationTo: 'geographic-areas',
          hasMany: true,
        },
        {
          name: 'geographicAreaFeedback',
          type: 'text',
          label: 'Vous ne trouvez pas de zone géographique appropriée ?',
          admin: {
            description:
              'Décrivez librement la zone manquante — un administrateur pourra ensuite la créer.',
          },
        },
        {
          name: 'activitySectors',
          type: 'select',
          label: "Secteur d'activité",
          hasMany: true,
          options: [...ACTIVITY_SECTOR_OPTIONS],
          defaultValue: ['all'],
        },
        {
          name: 'activitySectorOther',
          type: 'text',
          label: 'Autre secteur spécifique',
          admin: {
            condition: (data) =>
              Array.isArray(data?.activitySectors) &&
              (data.activitySectors as string[]).includes('other'),
          },
        },
        {
          name: 'nafCodeOther',
          type: 'text',
          label: 'Code NAF spécifique associé',
          admin: {
            condition: (data) =>
              Array.isArray(data?.activitySectors) &&
              (data.activitySectors as string[]).includes('naf-code'),
          },
        },
        {
          name: 'otherCriteria',
          type: 'array',
          label: 'Autres critères',
          labels: { singular: 'un autre critère', plural: 'autres critères' },
          admin: {
            components: {
              RowLabel: {
                path: '@/components/programs/NumberedRowLabel#NumberedRowLabel',
                clientProps: { singular: "Autre critère d'éligibilité" },
              },
            },
          },
          fields: [
            {
              name: 'value',
              type: 'text',
              label: "Critère d'éligibilité",
              required: true,
            },
          ],
        },
      ],
    },

    {
      name: 'additionalInfo',
      type: 'richText',
      label: 'Informations complémentaires',
    },

    // --- Variants ---
    {
      type: 'collapsible',
      label: "Conditions d'éligibilité variables selon le type de profil",
      admin: {
        initCollapsed: true,
        components: {
          Label: '@/components/programs/VariantsSectionLabel#VariantsSectionLabel',
        },
      },
      fields: [
        {
          name: 'variantsIntro',
          type: 'ui',
          label: '',
          admin: {
            components: {
              Field: '@/components/programs/VariantsSectionIntro#VariantsSectionIntro',
            },
          },
        },
        {
          name: 'variants',
          type: 'array',
          labels: { singular: 'un variant', plural: 'Variants' },
          admin: {
            components: {
              RowLabel: {
                path: '@/components/programs/NumberedRowLabel#NumberedRowLabel',
                clientProps: { singular: 'Variable' },
              },
            },
          },
          fields: [
            {
              name: 'conditions',
              type: 'array',
              minRows: 1,
              labels: { singular: 'une condition', plural: 'conditions' },
              label: "1. À quelles entreprises s'applique cette variante ?",
              admin: {
                description:
                  'Au moins une condition est requise. Ajoutez-en plusieurs si elles doivent toutes être vraies à la fois.',
                components: {
                  RowLabel: {
                    path: '@/components/programs/NumberedRowLabel#NumberedRowLabel',
                    clientProps: { singular: 'Condition' },
                  },
                },
              },
              fields: [
                {
                  name: 'etConnector',
                  type: 'ui',
                  label: '',
                  admin: {
                    components: {
                      Field:
                        '@/components/programs/VariantEtConnector#VariantEtConnector',
                    },
                  },
                },
                {
                  // Anonymous row: keeps "Type de condition" and "Valeur de la
                  // condition" side by side as in the mockup. A row carries no
                  // name, so child field paths are unchanged for the UI fields.
                  type: 'row',
                  fields: [
                    {
                      name: 'conditionType',
                      type: 'select',
                      label: 'Type de condition',
                      required: true,
                      options: [...CONDITION_TYPE_OPTIONS],
                      admin: { width: '50%' },
                    },
                    {
                      // Stored as JSON (a single column), not a `select hasMany`,
                      // on purpose: a multi-value field nested two arrays deep
                      // breaks Payload's version sub-table FK (it inserts the
                      // text row uuid into an integer parent_id). JSON keeps the
                      // multi-select on one column; the custom component renders
                      // the same chip picker as a native select.
                      name: 'companySizeValue',
                      type: 'json',
                      label: 'Valeur de la condition',
                      admin: {
                        width: '50%',
                        condition: (_data, siblingData) =>
                          siblingData?.conditionType === 'companySize',
                        components: {
                          Field:
                            '@/components/programs/CompanySizeMultiSelect#CompanySizeMultiSelect',
                        },
                      },
                    },
                    {
                      name: 'geographicAreaValue',
                      type: 'relationship',
                      label: 'Valeur de la condition',
                      relationTo: 'geographic-areas',
                      hasMany: true,
                      admin: {
                        width: '50%',
                        condition: (_data, siblingData) =>
                          siblingData?.conditionType === 'geographicArea',
                      },
                    },
                  ],
                },
                {
                  name: 'conditionReminder',
                  type: 'ui',
                  label: '',
                  admin: {
                    components: {
                      Field:
                        '@/components/programs/VariantConditionReminder#VariantConditionReminder',
                    },
                  },
                },
              ],
            },
            {
              name: 'modifications',
              type: 'array',
              minRows: 1,
              labels: {
                singular: 'un champ à modifier',
                plural: 'champs à modifier',
              },
              label: '2. Que faut-il modifier pour ces entreprises ?',
              admin: {
                description:
                  'La nouvelle valeur remplace la valeur générique, uniquement pour les entreprises mentionnées ci-dessus.',
                components: {
                  RowLabel: {
                    path: '@/components/programs/NumberedRowLabel#NumberedRowLabel',
                    clientProps: { singular: 'Champ à modifier' },
                  },
                },
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'field',
                      type: 'select',
                      label: 'Champ à modifier',
                      required: true,
                      options: [...MODIFIABLE_FIELD_OPTIONS],
                      admin: { width: '50%' },
                    },
                    {
                      name: 'newValue',
                      type: 'text',
                      label: 'Nouvelle valeur',
                      admin: {
                        width: '50%',
                        condition: (_data, siblingData) =>
                          TEXT_VALUE_MODIFICATION_FIELDS.includes(
                            siblingData?.field as string,
                          ),
                      },
                    },
                    {
                      name: 'contactOperator',
                      type: 'relationship',
                      relationTo: 'operators',
                      label: 'Nouvel opérateur de contact',
                      admin: {
                        width: '50%',
                        condition: (_data, siblingData) =>
                          siblingData?.field === 'contactOperateur',
                      },
                    },
                    {
                      name: 'otherOperators',
                      type: 'relationship',
                      relationTo: 'operators',
                      hasMany: true,
                      label: 'Nouveaux opérateurs',
                      admin: {
                        width: '50%',
                        condition: (_data, siblingData) =>
                          siblingData?.field === 'autresOperateurs',
                      },
                    },
                  ],
                },
                {
                  name: 'modReminder',
                  type: 'ui',
                  label: '',
                  admin: {
                    components: {
                      Field:
                        '@/components/programs/VariantModificationReminder#VariantModificationReminder',
                    },
                  },
                },
              ],
            },
            {
              name: 'ruleSummary',
              type: 'ui',
              label: '',
              admin: {
                components: {
                  Field:
                    '@/components/programs/VariantRuleSummary#VariantRuleSummary',
                },
              },
            },
          ],
        },
      ],
    },

    // --- Sidebar ---
    {
      // Machine identity carried into the pivot format. Generated automatically
      // by the assignCanonicalId hook, never edited by hand. Field access denies
      // create/update for everyone (admins included), so the value is read-only
      // through the UI and the REST/GraphQL API; only server-side writes with
      // overrideAccess (seed, hooks) populate it. Hidden from the admin UI but
      // still returned by the API and present in payload-types for the mapper.
      name: 'canonicalId',
      type: 'text',
      unique: true,
      index: true,
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
      admin: {
        description: 'Identifiant unique du dispositif.',
        position: 'sidebar',
      },
    },
    {
      name: 'workflowStatus',
      type: 'select',
      label: 'Statut de workflow',
      defaultValue: 'en-creation',
      required: true,
      options: [
        { label: 'En création', value: 'en-creation' },
        { label: 'En relecture', value: 'en-relecture' },
        { label: 'En cours de publication', value: 'en-cours-publication' },
        { label: 'Publié', value: 'publie' },
        { label: 'En cours de modification', value: 'en-cours-modification' },
        { label: 'Importé', value: 'importe' },
        { label: 'Annulé', value: 'annule' },
        { label: 'Archivé', value: 'archive' },
        { label: 'Remplacé', value: 'remplace' },
      ],
      admin: {
        position: 'sidebar',
        components: {
          Cell: '@/components/programs/WorkflowStatusCell#WorkflowStatusCell',
        },
      },
    },
    {
      name: 'replacedBy',
      type: 'relationship',
      label: 'Remplacé par',
      relationTo: 'programs',
      hasMany: false,
      admin: {
        position: 'sidebar',
        description:
          'Programme de remplacement. Requis lors du passage à l’état "Remplacé".',
        condition: (data) =>
          data?.workflowStatus === 'remplace' || Boolean(data?.replacedBy),
      },
      filterOptions: ({ id }) => ({
        id: { not_equals: id },
        workflowStatus: { not_in: ['annule', 'archive', 'remplace'] },
      }),
    },
    {
      name: 'workflowHistory',
      type: 'array',
      label: 'Historique des transitions',
      admin: {
        position: 'sidebar',
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
    },
    {
      name: '_status',
      type: 'select',
      label: 'Statut',
      options: [
        { label: 'Brouillon', value: 'draft' },
        { label: 'Publié', value: 'published' },
      ],
      admin: { position: 'sidebar' },
      access: {
        update: (({ req: { user } }) => {
          if (!user) return false;
          return UserRole.isAdmin(user);
        }) satisfies FieldAccess,
      },
    },
    {
      name: 'assignedContributors',
      type: 'relationship',
      label: 'Contributeurs assignés',
      relationTo: 'users',
      hasMany: true,
      admin: {
        position: 'sidebar',
        description: 'Contributeurs autorisés à éditer ce dispositif.',
      },
      access: {
        update: (({ req: { user } }) =>
          UserRole.isAdmin(user)) satisfies FieldAccess,
      },
    },

    // --- SEO (sidebar) ---
    {
      name: 'metaTitle',
      type: 'text',
      label: 'Titre SEO',
      admin: { position: 'sidebar' },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      label: 'Description SEO',
      admin: { position: 'sidebar' },
    },
  ],
};
