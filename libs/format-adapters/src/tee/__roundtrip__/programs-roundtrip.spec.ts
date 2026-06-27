// Boucle de validation TEE : programs.json → pivot → programs.json.
//
// Pour chaque dispositif : on charge la fiche source, on retire les clés non
// portées par le pivot (`publicodes`, `activable en autonomie`, `illustration`),
// on l'importe dans le format canonique puis on la réexporte, et on vérifie que
// la sortie (1) respecte le schéma TEE et (2) est **identique à l'entrée** (au
// trim près — le pivot nettoie les espaces parasites).
//
// ⚠️ ÉPHÉMÈRE : ce dossier dépend de la copie locale `static/input/programs.json`,
// vouée à disparaître. Quand cette entrée est supprimée, supprimer tout ce dossier
// (`__roundtrip__/`) — aucun autre test n'en dépend. La couverture pérenne de
// l'import/export vit dans TeeImporter.spec.ts / TeeExporter.spec.ts.
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
