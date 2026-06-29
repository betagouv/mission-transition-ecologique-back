// TEE validation loop: programs.json → pivot → programs.json.
//
// For each program: load the source record, drop the keys the pivot does not
// carry (`publicodes`, `activable en autonomie`, `illustration`), import it into
// the canonical format then re-export it, and check the output (1) matches the
// TEE schema and (2) is identical to the input (modulo trim — the pivot
// normalizes stray whitespace).
//
// ⚠️ EPHEMERAL: this folder depends on the local copy `static/input/programs.json`
// and is meant to disappear. When that input is removed, delete this whole folder
// (`__roundtrip__/`) — nothing else depends on it. The durable import/export
// coverage lives in TeeImporter.spec.ts / TeeExporter.spec.ts.
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import programs from '../../../static/input/programs.json'
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

describe('TEE round-trip (programs.json)', () => {
  it.each(allPrograms.map((program) => [String(program['id']), program] as const))(
    '%s : sortie conforme au schéma TEE et identique à l\'entrée (au trim près)',
    (_id, source) => {
      const actual = roundTrip(source)
      expect(teeProgramSchema.safeParse(actual).success).toBe(true)
      expect(deepTrim(actual)).toEqual(deepTrim(omitExcluded(source)))
    },
  )
})
