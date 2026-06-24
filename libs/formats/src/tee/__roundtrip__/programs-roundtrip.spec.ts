// Boucle de validation TEE : programs.json → pivot → programs.json.
//
// Pour chaque dispositif : on charge la fiche source, on retire les clés non
// portées par le pivot (`publicodes`, `activable en autonomie`, `illustration`),
// on l'importe dans le format canonique puis on la réexporte, et on vérifie que
// la sortie est **identique à l'entrée** (au trim près — le pivot nettoie les
// espaces parasites). Les écarts irréductibles sont listés dans `known-gaps.ts`.
//
// ⚠️ ÉPHÉMÈRE : ce dossier dépend de docs/sources/programs.json, voué à
// disparaître. Quand la source est supprimée, supprimer tout ce dossier
// (`__roundtrip__/`) — aucun autre test n'en dépend.
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import programs from '../../../../../docs/sources/programs.json'
import { TeeImporter } from '../TeeImporter'
import { TeeExporter } from '../TeeExporter'
import { KNOWN_GAPS } from './known-gaps'

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

const allPrograms = programs as Record<string, unknown>[]
const testable = allPrograms.filter((program) => !KNOWN_GAPS.has(String(program['id'])))

const importer = new TeeImporter()
const exporter = new TeeExporter()
const validator = new CanonicalProgramValidator()

describe('TEE round-trip (programs.json)', () => {
  it('couvre la quasi-totalité des dispositifs (le reste = known-gaps)', () => {
    expect(testable.length).toBe(allPrograms.length - KNOWN_GAPS.size)
  })

  it.each(testable.map((program) => [String(program['id']), program] as const))(
    '%s : sortie identique à l\'entrée (hors publicodes, au trim près)',
    (_id, source) => {
      const program = validator.parse(importer.import(source))
      const actual = exporter.export(program)
      expect(deepTrim(actual)).toEqual(deepTrim(omitExcluded(source)))
    },
  )
})
