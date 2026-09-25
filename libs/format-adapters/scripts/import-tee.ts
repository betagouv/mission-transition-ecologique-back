// Regenerates the canonical store from `static/input/programs.json`, WITHOUT
// Payload: each record is mapped by `TeeImporter`, gets a deterministic id
// derived from its slug (`SlugCanonicalId`) and the run timestamp as
// `date_mise_a_jour`, then is validated + upserted via `CanonicalProgramService`.
// Invalid records are skipped and reported (never persisted silently).
//
// Run from the repo root: `nx run @tee-backoffice/format-adapters:import:tee`.
// With `--remote` (the daily refresh on Scalingo), the two JSON files are read
// straight from the upstream repository instead of `static/input/`.
//
// The store is aligned on the upstream snapshot, never emptied: upserts, plus
// deletion of the programs gone upstream. The snapshot is rejected (store
// untouched, non-zero exit) when it holds no valid program or would remove more
// than the guard allows; `--allow-mass-removal` lifts that ceiling on purpose.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  CanonicalProgramService,
  CanonicalSnapshotGuard,
  type CanonicalProgramInput,
  type CanonicalProgramKey,
} from '@tee-backoffice/canonical'
import { createCanonicalProgramRepository } from '@tee-backoffice/canonical-store'
import { ProgramRedirects } from '../src/tee/ProgramRedirects'
import { RedirectTombstoneBuilder } from '../src/tee/RedirectTombstoneBuilder'
import { SlugCanonicalId } from '../src/tee/SlugCanonicalId'
import { TeeImporter } from '../src/tee/TeeImporter'
import type { TeeRecord } from '../src/tee/TeeImporter'
import { UpstreamJsonSource } from '../src/tee/UpstreamJsonSource'

const REMOTE = process.argv.includes('--remote')
const ALLOW_MASS_REMOVAL = process.argv.includes('--allow-mass-removal')

// Live upstream input (the daily workflow overwrites it). Falls back to the
// frozen round-trip fixture so a local run works without fetching first.
const LIVE_PATH = resolve(process.cwd(), 'static/input/programs.json')
const FIXTURE_PATH = resolve(process.cwd(), 'static/input/programs-tests.json')

// Slug redirects (former → current), fetched next to programs.json by the daily
// workflow. Falls back to the frozen fixture; absent → redirects step skipped.
const LIVE_REDIRECTS_PATH = resolve(process.cwd(), 'static/input/redirects.json')
const FIXTURE_REDIRECTS_PATH = resolve(process.cwd(), 'static/input/redirects-tests.json')

type RedirectsFile = ConstructorParameters<typeof ProgramRedirects>[0]

/** Reads both inputs: from the upstream repository, or from `static/input/`. */
async function loadInputs(): Promise<{ records: TeeRecord[]; redirects: ProgramRedirects }> {
  if (!REMOTE) return { records: loadLocalRecords(), redirects: loadLocalRedirects() }

  const source = UpstreamJsonSource.forEnvironment()
  process.stdout.write(`Source distante : ${source.describe()}\n`)
  const records = await source.programs<TeeRecord[]>()
  const redirects = await source.redirects<RedirectsFile>()
  if (!redirects) process.stdout.write('Redirections : fichier amont absent, étape ignorée.\n')
  return { records, redirects: new ProgramRedirects(redirects ?? undefined) }
}

function loadLocalRecords(): TeeRecord[] {
  const inputPath = existsSync(LIVE_PATH) ? LIVE_PATH : FIXTURE_PATH
  process.stdout.write(`Source : ${inputPath}\n`)
  return JSON.parse(readFileSync(inputPath, 'utf8')) as TeeRecord[]
}

function loadLocalRedirects(): ProgramRedirects {
  const path = existsSync(LIVE_REDIRECTS_PATH)
    ? LIVE_REDIRECTS_PATH
    : existsSync(FIXTURE_REDIRECTS_PATH)
      ? FIXTURE_REDIRECTS_PATH
      : undefined
  if (!path) {
    process.stdout.write('Redirections : aucun redirects.json — étape ignorée.\n')
    return new ProgramRedirects(undefined)
  }
  process.stdout.write(`Redirections : ${path}\n`)
  return new ProgramRedirects(JSON.parse(readFileSync(path, 'utf8')))
}

async function main(): Promise<void> {
  const { records, redirects } = await loadInputs()
  const repository = await createCanonicalProgramRepository()
  const service = new CanonicalProgramService(repository)

  const importer = new TeeImporter()
  const now = new Date().toISOString()

  // Phase 1 — map every upstream record to a canonical input (id derived from
  // the slug, run timestamp as date_mise_a_jour).
  const inputs: CanonicalProgramInput[] = records.map((record) => {
    const input = importer.import(record)
    input.id = SlugCanonicalId.from(input.slug)
    input.date_mise_a_jour = now
    return input
  })
  const inputsBySlug = new Map(inputs.map((input) => [input.slug, input]))

  // Phase 2 — apply redirects: mark surviving former slugs `remplace` in place,
  // and synthesize `remplace` tombstones (cloning the replacement's content) for
  // former slugs no longer present, so a consumer holding them can follow on.
  const { tombstones, markedInPlace, skipped } = new RedirectTombstoneBuilder().build(redirects, inputsBySlug)
  inputs.push(...tombstones)

  // Phase 3 — align the store on the snapshot: validated first, guarded, then
  // deletions + upserts in one transaction.
  const guard = new CanonicalSnapshotGuard(ALLOW_MASS_REMOVAL ? { maxRemovalRatio: 1 } : {})
  const report = await service.applySnapshot(inputs, guard)

  process.stdout.write(
    `\n✓ ${report.saved.toString()}/${inputs.length.toString()} dispositifs écrits dans le store canonical\n`,
  )
  writeKeys('Retirés (absents de l\'amont)', report.removed)
  writeKeys('Réidentifiés (même slug, nouvel identifiant)', report.superseded)
  writeKeys('Conservés tels quels (entrée amont invalide)', report.kept)
  if (redirects.size > 0) {
    process.stdout.write(
      `Redirections : ${markedInPlace.length.toString()} marquée(s) en place, ${tombstones.length.toString()} tombstone(s) créé(s)${
        skipped.length > 0 ? `, ${skipped.length.toString()} ignorée(s) (cible absente)` : ''
      }\n`,
    )
    for (const skip of skipped) {
      process.stdout.write(`  - ${skip.former} → ${skip.current} : ${skip.reason}\n`)
    }
  }
  writeList(
    'Ignorés (invalides)',
    report.invalid.map((entry) => entry.slug || '(slug manquant)'),
  )
}

function writeKeys(label: string, keys: CanonicalProgramKey[]): void {
  writeList(label, keys.map((key) => key.slug))
}

function writeList(label: string, slugs: string[]): void {
  if (slugs.length === 0) return
  process.stdout.write(`${label} : ${slugs.length.toString()}\n`)
  const preview = slugs.slice(0, 20).map((slug) => `  - ${slug}`)
  process.stdout.write(`${preview.join('\n')}${slugs.length > 20 ? '\n  …' : ''}\n`)
}

main().catch((err: unknown) => {
  process.stderr.write(`${String(err)}\n`)
  process.exit(1)
})
