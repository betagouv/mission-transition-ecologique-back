import type { CollectionConfig, FieldAccess } from 'payload'
import { ProgramAccessPolicy } from '@/services/access/ProgramAccessPolicy'
import { beforeChangeWorkflow } from '@/hooks/programs/beforeChangeWorkflow'
import { assignCreatorOnCreate } from '@/hooks/programs/assignCreatorOnCreate'
import { assignCanonicalId } from '@/hooks/programs/assignCanonicalId'
import { syncCanonicalOnPublish } from '@/hooks/programs/syncCanonicalOnPublish'
import { THEMES_OPTIONS } from '@/constants/themesOptions'
import { COMPANY_SIZE_OPTIONS } from '@/constants/companySizeOptions'
import { ACTIVITY_SECTOR_OPTIONS } from '@/constants/activitySectorOptions'
import { CONTACT_METHOD_OPTIONS } from '@/constants/contactMethodOptions'
import { AID_TYPE_OPTIONS } from '@/constants/aidTypeOptions'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'
import { UrlValidator } from '@/utils/UrlValidator'

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
      validate: UrlValidator.validate,
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
            { description: null, links: [{ url: '', linkLabel: '' }] },
            { description: null, links: [{ url: '', linkLabel: '' }] },
            { description: null },
          ],
          fields: [
            {
              name: 'description',
              type: 'richText',
              label: "Description de l'étape",
              required: true,
              admin: {
                description:
                  "Une étape courte et actionnable, dans l'ordre chronologique. Ex. étape 1 : « Consultez le document pour vérifier l'éligibilité de votre projet », étape 2 : « Déposez votre demande de financement via le formulaire », étape 3 : « Recevez votre aide financière et réalisez vos travaux ».",
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
                  name: 'linkLabel',
                  type: 'text',
                  label: 'Titre du lien',
                  admin: {
                    description: 'Exemple : Document, Formulaire.',
                  },
                },
                {
                  name: 'url',
                  type: 'text',
                  label: 'URL',
                  validate: UrlValidator.validate,
                  admin: {
                    description: 'Lien de votre document au format https://...',
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
          admin: {
            date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' },
          },
        },
        {
          name: 'validityEnd',
          type: 'date',
          label: 'Date de fin de validité',
          admin: {
            date: { pickerAppearance: 'dayOnly', displayFormat: 'dd/MM/yyyy' },
          },
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
            description:
              'Thématiques du dispositif. Indicatif pour le rapprochement avec les projets.',
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
          admin: {
            // All projects offered, no thematic filtering (deliberate).
            sortOptions: 'title',
            // Disabled here: the project workflow stays separate from the program one.
            allowCreate: false,
          },
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
        // The workflow status is driven by the WorkflowActionBar buttons; only
        // super-admins keep the raw select for manual overrides.
        condition: (_data, _siblingData, { user }) =>
          UserRole.isSuperAdmin(
            user as { role: UserRoleValue } | null | undefined,
          ),
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
        // No drawer to edit the linked user from within the program form.
        allowEdit: false,
        // Admins always edit this field; creators only see a read-only display
        // (access.update is false for them) when contributors are assigned.
        condition: (data, _siblingData, { user }) =>
          UserRole.isAdmin(user as { role: UserRoleValue } | null | undefined) ||
          (Array.isArray(data?.assignedContributors) &&
            data.assignedContributors.length > 0),
      },
      // The condition only hides the field in the UI; access locks API writes.
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
      admin: {
        position: 'sidebar',
        condition: (_data, _siblingData, { user }) =>
          UserRole.isAdmin(user as { role: UserRoleValue } | null | undefined),
      },
      // The condition only hides the field in the UI; access locks API writes.
      access: {
        create: (({ req: { user } }) =>
          UserRole.isAdmin(user)) satisfies FieldAccess,
        update: (({ req: { user } }) =>
          UserRole.isAdmin(user)) satisfies FieldAccess,
      },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      label: 'Description SEO',
      admin: {
        position: 'sidebar',
        condition: (_data, _siblingData, { user }) =>
          UserRole.isAdmin(user as { role: UserRoleValue } | null | undefined),
      },
      // The condition only hides the field in the UI; access locks API writes.
      access: {
        create: (({ req: { user } }) =>
          UserRole.isAdmin(user)) satisfies FieldAccess,
        update: (({ req: { user } }) =>
          UserRole.isAdmin(user)) satisfies FieldAccess,
      },
    },
  ],
};
