// TEMP audit (feat/tee-export): real-path round-trip check.
// Reads canonical.db (produced by json → Payload → canonical via the seed),
// re-exports each program with TeeExporter, and diffs against programs.json by
// slug. Prints clean/mismatch counts + a per-top-level-key mismatch histogram,
// plus a focused breakdown of `conditions d'éligibilité` sub-keys.
//
// Run from apps/cms: `tsx src/scripts/audit-eligibilite.ts`
// Delete with the rest of the round-trip tooling when programs.json disappears.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@libsql/client'
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import { TeeExporter } from '@tee-backoffice/format-adapters'

const EXCLUDED_KEYS = ['publicodes', 'activable en autonomie', 'illustration']

const omitExcluded = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !EXCLUDED_KEYS.includes(key)))

// Trim strings, preserve array order, but SORT object keys: programs.json and
// TeeExporter emit the same keys in different orders, which is not a real diff.
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

async function main() {
  const dbUrl = `file:${resolve(process.cwd(), '../../libs/canonical-store/canonical.db')}`
  const programsPath = resolve(process.cwd(), '../../docs/sources/programs.json')
  const sources = JSON.parse(readFileSync(programsPath, 'utf8')) as Record<string, unknown>[]
  const sourceBySlug = new Map(sources.map((p) => [String(p['id']), p]))

  const client = createClient({ url: dbUrl })
  const rows = await client.execute('SELECT data FROM canonical_programs')

  const validator = new CanonicalProgramValidator()
  const exporter = new TeeExporter()

  let clean = 0
  let mismatch = 0
  let invalid = 0
  let unmatched = 0
  const keyHisto = new Map<string, number>()
  const condHisto = new Map<string, number>()
  const edHisto = new Map<string, number>()
  const companyHisto = new Map<string, number>()
  const bump = (histo: Map<string, number>, key: string) => histo.set(key, (histo.get(key) ?? 0) + 1)

  for (const row of rows.rows) {
    const data = JSON.parse(String(row.data)) as Record<string, unknown>
    const result = validator.validate(data)
    if (!result.success) {
      invalid++
      continue
    }
    const exported = exporter.export(result.program) as Record<string, unknown>
    const slug = String(exported['id'])
    const source = sourceBySlug.get(slug)
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

    const keys = new Set([...Object.keys(exported), ...Object.keys(expected)])
    for (const key of keys) {
      if (!eq(exported[key], expected[key])) keyHisto.set(key, (keyHisto.get(key) ?? 0) + 1)
    }

    // Focused: which sub-keys of `conditions d'éligibilité` diverge?
    const ce = (expected["conditions d'éligibilité"] ?? {}) as Record<string, unknown>
    const ca = (exported["conditions d'éligibilité"] ?? {}) as Record<string, unknown>
    for (const key of new Set([...Object.keys(ce), ...Object.keys(ca)])) {
      if (!eq(ca[key], ce[key])) bump(condHisto, key)
    }

    // Focused: `eligibilityData` and its `company.*` sub-keys (the 3 parallel issues).
    const ede = (expected['eligibilityData'] ?? {}) as Record<string, unknown>
    const eda = (exported['eligibilityData'] ?? {}) as Record<string, unknown>
    for (const key of new Set([...Object.keys(ede), ...Object.keys(eda)])) {
      if (!eq(eda[key], ede[key])) bump(edHisto, key)
    }
    const ce2 = (ede['company'] ?? {}) as Record<string, unknown>
    const ca2 = (eda['company'] ?? {}) as Record<string, unknown>
    for (const key of new Set([...Object.keys(ce2), ...Object.keys(ca2)])) {
      if (!eq(ca2[key], ce2[key])) bump(companyHisto, key)
    }
  }

  const total = clean + mismatch + invalid + unmatched
  console.log(`\n=== Real-path audit: ${total} canonical programs ===`)
  console.log(`clean=${clean}  mismatch=${mismatch}  invalid=${invalid}  unmatched=${unmatched}`)
  console.log('\n--- mismatch top-level keys (desc) ---')
  for (const [key, n] of [...keyHisto].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${key}`)
  console.log("\n--- conditions d'éligibilité sub-keys (desc) ---")
  for (const [key, n] of [...condHisto].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${key}`)
  console.log('\n--- eligibilityData sub-keys (desc) ---')
  for (const [key, n] of [...edHisto].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${key}`)
  console.log('\n--- eligibilityData.company sub-keys (desc) ---')
  for (const [key, n] of [...companyHisto].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${key}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
