// Canonical → TEE export. Reads the canonical store, writes the TEE feed to
// `static/exports/tee-programs.json`, then prints a per-field recap of what
// still diverges from the local reference `static/input/programs.json` — so the
// remaining shared work is visible at a glance ("which fields still have
// problems, and are we done yet?").
//
// Run from the repo root: `pnpm export:tee`
// or: `nx run @tee-backoffice/format-adapters:export:tee`.
//
// The recap section is EPHEMERAL: it disappears with the input programs.json.
// The feed export itself is permanent.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CanonicalProgramService } from '@tee-backoffice/canonical'
import { createCanonicalProgramRepository } from '@tee-backoffice/canonical-store'
import { TeeExporter } from '../src/tee/TeeExporter'

const OUTPUT_PATH = resolve(process.cwd(), 'static/exports/tee-programs.json')
const REFERENCE_PATH = resolve(process.cwd(), 'static/input/programs.json')

// Keys we never compare (not part of the canonical model).
const EXCLUDED_KEYS = ['publicodes', 'activable en autonomie', 'illustration']

// Short human note per field known to still diverge, so the recap reads as a
// shared to-do list rather than a raw histogram. Unlisted fields print bare.
const FIELD_NOTES: Record<string, string> = {
  "conditions d'éligibilité": 'texte verbatim non porté — le modèle structuré fait foi',
  description: 'markdown (espaces / échappement) — surtout cosmétique',
  'description longue': 'markdown (espaces / échappement) — surtout cosmétique',
  'montant du financement': 'cas « étude » portant un montant — non mappé',
  objectifs: 'liens « formulaire » non importés',
  'champs conditionnels': 'variantes du pivot non reconstruites',
  'aide temporairement indisponible': 'flag non porté à l\'import',
}

const omitExcluded = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !EXCLUDED_KEYS.includes(key)))

// Trim strings, preserve array order, but SORT object keys: the exporter and
// programs.json emit the same keys in different orders — not a real diff.
const deepTrim = (value: unknown): unknown => {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(deepTrim)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, inner]) => [key, deepTrim(inner)]),
    )
  }
  return value
}

const eq = (a: unknown, b: unknown): boolean =>
  JSON.stringify(deepTrim(a)) === JSON.stringify(deepTrim(b))

function reportGaps(feed: Record<string, unknown>[]): void {
  if (!existsSync(REFERENCE_PATH)) {
    process.stdout.write('\n(référence programs.json absente — récap des écarts ignoré)\n')
    return
  }
  const sources = JSON.parse(readFileSync(REFERENCE_PATH, 'utf8')) as Record<string, unknown>[]
  const sourceBySlug = new Map(sources.map((p) => [String(p['id']), p]))

  let clean = 0
  let mismatch = 0
  let unmatched = 0
  const histo = new Map<string, number>()

  for (const exported of feed) {
    const source = sourceBySlug.get(String(exported['id']))
    if (!source) {
      unmatched++
      continue
    }
    const expected = omitExcluded(source)
    if (eq(exported, expected)) {
      clean++
      continue
    }
    mismatch++
    for (const key of new Set([...Object.keys(exported), ...Object.keys(expected)])) {
      if (!eq(exported[key], expected[key])) histo.set(key, (histo.get(key) ?? 0) + 1)
    }
  }

  const matched = clean + mismatch
  process.stdout.write('\n=== Récap des écarts vs programs.json ===\n')
  process.stdout.write(
    `conformes = ${clean.toString()}/${matched.toString()}   en écart = ${mismatch.toString()}   (non appariés = ${unmatched.toString()})\n`,
  )
  if (histo.size === 0) {
    process.stdout.write('\n🎉 Aucun écart — le travail commun est terminé.\n')
    return
  }
  process.stdout.write('\nChamps encore en écart (nb de dispositifs) :\n')
  for (const [key, n] of [...histo].sort((a, b) => b[1] - a[1])) {
    const note = FIELD_NOTES[key] ? `  — ${FIELD_NOTES[key]}` : ''
    process.stdout.write(`${n.toString().padStart(4)}  ${key}${note}\n`)
  }
}

async function main(): Promise<void> {
  const repository = await createCanonicalProgramRepository()
  const service = new CanonicalProgramService(repository)
  const programs = await service.getAll()
  const feed = new TeeExporter().exportMany(programs)

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(feed, null, 2)}\n`)
  process.stdout.write(`\n✓ ${feed.length.toString()} dispositifs exportés → ${OUTPUT_PATH}\n`)

  reportGaps(feed as unknown as Record<string, unknown>[])
}

main().catch((err: unknown) => {
  process.stderr.write(`${String(err)}\n`)
  process.exit(1)
})
