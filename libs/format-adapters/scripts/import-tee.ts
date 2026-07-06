// Regenerates the canonical store from `static/input/programs.json`, WITHOUT
// Payload: each record is mapped by `TeeImporter`, gets a deterministic id
// derived from its slug (`SlugCanonicalId`) and the run timestamp as
// `date_mise_a_jour`, then is validated + upserted via `CanonicalProgramService`.
// Invalid records are skipped and reported (never persisted silently).
//
// Run from the repo root: `nx run @tee-backoffice/format-adapters:import:tee`.
//
// For a CLEAN rebuild that reflects upstream deletions, delete the store first
// (the daily workflow does `rm -f libs/canonical-store/canonical.db` before this
// step). Re-importing onto a non-empty store would upsert the current records
// but leave previously-removed dispositifs behind — the script warns if so.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CanonicalProgramService, type CanonicalProgramInput } from '@tee-backoffice/canonical'
import { createCanonicalProgramRepository } from '@tee-backoffice/canonical-store'
import { ProgramRedirects } from '../src/tee/ProgramRedirects'
import { RedirectTombstoneBuilder } from '../src/tee/RedirectTombstoneBuilder'
import { SlugCanonicalId } from '../src/tee/SlugCanonicalId'
import { TeeImporter } from '../src/tee/TeeImporter'
import type { TeeRecord } from '../src/tee/TeeImporter'

// Live upstream input (the daily workflow overwrites it). Falls back to the
// frozen round-trip fixture so a local run works without fetching first.
const LIVE_PATH = resolve(process.cwd(), 'static/input/programs.json')
const FIXTURE_PATH = resolve(process.cwd(), 'static/input/programs-tests.json')

// Slug redirects (former → current), fetched next to programs.json by the daily
// workflow. Falls back to the frozen fixture; absent → redirects step skipped.
const LIVE_REDIRECTS_PATH = resolve(process.cwd(), 'static/input/redirects.json')
const FIXTURE_REDIRECTS_PATH = resolve(process.cwd(), 'static/input/redirects-tests.json')

function loadRedirects(): ProgramRedirects {
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
  const inputPath = existsSync(LIVE_PATH) ? LIVE_PATH : FIXTURE_PATH
  process.stdout.write(`Source : ${inputPath}\n`)
  const records = JSON.parse(readFileSync(inputPath, 'utf8')) as TeeRecord[]
  const repository = await createCanonicalProgramRepository()
  const service = new CanonicalProgramService(repository)

  const existing = await service.getAll()
  if (existing.length > 0) {
    process.stdout.write(
      `⚠ ${existing.length.toString()} dispositifs déjà présents — pour une régénération propre (suppressions reflétées), supprimer canonical.db avant l'import.\n`,
    )
  }

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
  const redirects = loadRedirects()
  const { tombstones, markedInPlace, skipped } = new RedirectTombstoneBuilder().build(redirects, inputsBySlug)
  inputs.push(...tombstones)

  // Phase 3 — validate + upsert everything (real programs + tombstones).
  let saved = 0
  const invalid: string[] = []
  for (const input of inputs) {
    const result = await service.save(input)
    if (result.status === 'saved') saved++
    else invalid.push(result.slug || '(slug manquant)')
  }

  process.stdout.write(`\n✓ ${saved.toString()}/${inputs.length.toString()} dispositifs importés dans le store canonical\n`)
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
  if (invalid.length > 0) {
    process.stdout.write(`Ignorés (invalides) : ${invalid.length.toString()}\n`)
    const preview = invalid.slice(0, 20).map((slug) => `  - ${slug}`)
    process.stdout.write(`${preview.join('\n')}${invalid.length > 20 ? '\n  …' : ''}\n`)
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${String(err)}\n`)
  process.exit(1)
})
