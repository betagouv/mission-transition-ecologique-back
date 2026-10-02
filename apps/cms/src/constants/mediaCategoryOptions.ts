export const MEDIA_CATEGORY_OPTIONS = [
  { label: "Logo d'opérateur", value: 'operator-logo' },
  { label: 'Image de projet', value: 'project-image' },
] as const

export type MediaCategory = (typeof MEDIA_CATEGORY_OPTIONS)[number]['value']
