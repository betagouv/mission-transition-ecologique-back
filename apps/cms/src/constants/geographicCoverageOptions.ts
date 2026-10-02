export const GEOGRAPHIC_COVERAGE_OPTIONS = [
  { label: 'National', value: 'national' },
  { label: 'Régional', value: 'regional' },
  { label: 'Départemental', value: 'departemental' },
  { label: 'Régional et départemental', value: 'regional-departemental' },
] as const

export type GeographicCoverage = (typeof GEOGRAPHIC_COVERAGE_OPTIONS)[number]['value']

export type CoverageAreaType = 'region' | 'departement'

/** Area levels an editor can pick for each coverage; a national coverage takes no area. */
export const COVERAGE_AREA_TYPES: Record<GeographicCoverage, readonly CoverageAreaType[]> = {
  national: [],
  regional: ['region'],
  departemental: ['departement'],
  'regional-departemental': ['region', 'departement'],
}

/** Area levels of a coverage value read from untyped form or request data. */
export function coverageAreaTypes(coverage: unknown): readonly CoverageAreaType[] {
  return typeof coverage === 'string' && coverage in COVERAGE_AREA_TYPES
    ? COVERAGE_AREA_TYPES[coverage as GeographicCoverage]
    : []
}

export const AREA_TYPE_LABELS: Record<string, string> = {
  region: 'région',
  departement: 'département',
  commune: 'commune',
  epci: 'EPCI',
  autre: 'autre',
}
