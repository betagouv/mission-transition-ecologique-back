import type { CollectionConfig } from 'payload'

const THEMES_OPTIONS = [
  { label: 'Énergie', value: 'energy' },
  { label: 'Déchets', value: 'waste' },
  { label: 'Mobilité', value: 'mobility' },
  { label: 'Environnement', value: 'environmental' },
  { label: 'Bâtiment', value: 'building' },
  { label: 'Eau', value: 'water' },
  { label: 'Éco-conception', value: 'eco-design' },
  { label: 'Ressources humaines', value: 'rh' },
  { label: 'Biodiversité', value: 'biodiversite' },
]

const NAF_SECTIONS_OPTIONS = [
  { label: 'A — Agriculture, sylviculture et pêche', value: 'A' },
  { label: 'B — Industries extractives', value: 'B' },
  { label: 'C — Industrie manufacturière', value: 'C' },
  {
    label: "D — Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné",
    value: 'D',
  },
  {
    label:
      "E — Production et distribution d'eau ; assainissement, gestion des déchets et dépollution",
    value: 'E',
  },
  { label: 'F — Construction', value: 'F' },
  { label: "G — Commerce ; réparation d'automobiles et de motocycles", value: 'G' },
  { label: 'H — Transports et entreposage', value: 'H' },
  { label: 'I — Hébergement et restauration', value: 'I' },
  { label: 'J — Information et communication', value: 'J' },
  { label: "K — Activités financières et d'assurance", value: 'K' },
  { label: 'L — Activités immobilières', value: 'L' },
  { label: 'M — Activités spécialisées, scientifiques et techniques', value: 'M' },
  { label: 'N — Activités de services administratifs et de soutien', value: 'N' },
  { label: 'O — Administration publique', value: 'O' },
  { label: 'P — Enseignement', value: 'P' },
  { label: 'Q — Santé humaine et action sociale', value: 'Q' },
  { label: 'R — Arts, spectacles et activités récréatives', value: 'R' },
  { label: 'S — Autres activités de services', value: 'S' },
  { label: "T — Activités des ménages en tant qu'employeurs", value: 'T' },
  { label: 'U — Activités extra-territoriales', value: 'U' },
]

export const Projects: CollectionConfig = {
  slug: 'projects',
  labels: {
    singular: 'Projet',
    plural: 'Projets',
  },
  admin: {
    useAsTitle: 'title',
    hidden: ({ user }) => user?.role === 'contributeur',
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
