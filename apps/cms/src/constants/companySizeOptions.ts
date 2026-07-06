/**
 * Company-size select (single choice). `all` ("Toutes tailles") is the default
 * (no headcount constraint); `specific` reveals the min/max integer fields. The
 * seven buckets in between map to fixed numeric bounds (see COMPANY_SIZE_BOUNDS).
 */
export const COMPANY_SIZE_OPTIONS = [
  { label: 'Toutes tailles', value: 'all' },
  { label: '0 à 9 salariés', value: '0-9' },
  { label: '10 à 19 salariés', value: '10-19' },
  { label: '20 à 49 salariés', value: '20-49' },
  { label: '50 à 249 salariés', value: '50-249' },
  { label: '250 à 499 salariés', value: '250-499' },
  { label: '500 à 4999 salariés', value: '500-4999' },
  { label: '+ 5000 salariés', value: '5000+' },
  { label: 'Taille spécifique', value: 'specific' },
] as const

/** Size buckets that carry fixed numeric bounds (all options but `all`/`specific`). */
export const COMPANY_SIZE_BUCKETS = [
  '0-9',
  '10-19',
  '20-49',
  '50-249',
  '250-499',
  '500-4999',
  '5000+',
] as const

export type CompanySizeBucket = (typeof COMPANY_SIZE_BUCKETS)[number]
