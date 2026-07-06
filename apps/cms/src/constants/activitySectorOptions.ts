/**
 * Activity-sector select (single choice, three values). `all` is the default
 * (no sector restriction); `naf-sections` reveals the NAF section checkboxes;
 * `specific` reveals a free description plus an associated NAF code.
 */
export const ACTIVITY_SECTOR_OPTIONS = [
  { label: "Tous secteurs d'activité", value: 'all' },
  { label: 'Section du code NAF', value: 'naf-sections' },
  { label: "Autres secteurs d'activité spécifiques", value: 'specific' },
] as const
