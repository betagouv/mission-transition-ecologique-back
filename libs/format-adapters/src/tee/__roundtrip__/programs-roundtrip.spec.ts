// TEE validation loop: programs.json → pivot → programs.json.
//
// For each program: load the source record, drop the keys the pivot does not
// carry (`publicodes`, `activable en autonomie`, `illustration`), import it into
// the canonical format then re-export it, and check the output (1) matches the
// TEE schema and (2) is identical to the input (modulo trim — the pivot
// normalizes stray whitespace).
//
// ⚠️ EPHEMERAL: this folder depends on the frozen copy
// `static/input/programs-tests.json` (the curated round-trip fixture, distinct
// from the live `programs.json` the daily pipeline overwrites) and is meant to
// disappear. When that fixture is removed, delete this whole folder
// (`__roundtrip__/`) — nothing else depends on it. The durable import/export
// coverage lives in TeeImporter.spec.ts / TeeExporter.spec.ts.
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import programs from '../../../static/input/programs-tests.json'
import { TeeImporter } from '../TeeImporter'
import { TeeExporter } from '../TeeExporter'
import { teeProgramSchema } from '../tee-program.schema'

/** Clés de programs.json absentes du pivot (donc hors comparaison). */
const EXCLUDED_KEYS = ['publicodes', 'activable en autonomie', 'illustration']

const omitExcluded = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !EXCLUDED_KEYS.includes(key)))

/** Trim récursif : le pivot normalise les chaînes, on compare au trim près. */
const deepTrim = (value: unknown): unknown => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(deepTrim)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, deepTrim(inner)]))
  }
  return value
}

const importer = new TeeImporter()
const exporter = new TeeExporter()
const validator = new CanonicalProgramValidator()

/** Réexporte une fiche ; `null` si elle n'est pas un canonical valide. */
const roundTrip = (source: Record<string, unknown>): Record<string, unknown> | null => {
  const result = validator.validate(importer.import(source))
  return result.success ? (exporter.export(result.program) as Record<string, unknown>) : null
}

const allPrograms = programs as Record<string, unknown>[]

/**
 * Fixture records carrying a step link to a local file pasted behind `https://`
 * (`https://file:///Users/...`): the pivot rejects such a url, so they cannot
 * round-trip until upstream fixes the link.
 */
const REJECTED_IDS = [
  'cheque-transition-tissu-economique',
  'ibac-pme',
  'etudes-de-faisabilite-de-projet-de-production-delectricite-renouvelable-en-outre-mer-et-corse',
]

const byId = (predicate: (id: string) => boolean) =>
  allPrograms
    .map((program) => [String(program['id']), program] as const)
    .filter(([id]) => predicate(id))

describe('TEE round-trip (programs.json)', () => {
  it.each(byId((id) => REJECTED_IDS.includes(id)))('%s : rejeté par le pivot (lien local)', (_id, source) => {
    expect(roundTrip(source)).toBeNull()
  })

  it.each(byId((id) => !REJECTED_IDS.includes(id)))(
    '%s : sortie conforme au schéma TEE et identique à l\'entrée (au trim près)',
    (_id, source) => {
      const actual = roundTrip(source)
      expect(teeProgramSchema.safeParse(actual).success).toBe(true)
      expect(deepTrim(actual)).toEqual(deepTrim(omitExcluded(source)))
    },
  )
})
