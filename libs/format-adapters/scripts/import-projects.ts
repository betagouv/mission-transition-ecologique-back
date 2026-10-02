// Aligns the canonical project store on `static/input/projects.json`, WITHOUT
// Payload: the records are mapped by `TeeProjectImporter` (id derived from the
// slug, run timestamp as `date_mise_a_jour`), then validated + upserted via
// `CanonicalProjectService`. Invalid records are skipped and reported (never
// persisted silently), and so are the upstream records whose shape is broken:
// the stored row of such a project is kept, not removed as gone upstream.
// A project whose slug is already stored keeps its stored id (e.g. the one the
// CMS wrote), and the references to projects and programs follow the stored ids:
// the derived id only names an entity the store does not know yet.
//
// Run from the repo root: `nx run @tee-backoffice/format-adapters:import:projects`.
// With `--remote` (the daily refresh on Scalingo), the two JSON files are read
// straight from the upstream repository instead of `static/input/`.
//
// The store is aligned on the upstream snapshot, never emptied: upserts, plus
// deletion of the projects gone upstream. The snapshot is rejected (store
// untouched, non-zero exit) when it holds no valid project or would remove more
// than the guard allows; `--allow-mass-removal` lifts that ceiling on purpose.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CanonicalIdentityMap,
  CanonicalProjectService,
  CanonicalSnapshotGuard,
  type CanonicalKey,
  type CanonicalProjectInput,
} from '@tee-backoffice/canonical'
import { createCanonicalProgramRepository, createCanonicalProjectRepository } from '@tee-backoffice/canonical-store'
import { ProjectRedirects } from '../src/tee/ProjectRedirects'
import { ProjectTombstoneBuilder } from '../src/tee/ProjectTombstoneBuilder'
import { SlugCanonicalId } from '../src/tee/SlugCanonicalId'
import { TeeProjectImporter } from '../src/tee/TeeProjectImporter'
import type { TeeProject } from '../src/tee/tee-project.schema'
import { TeeProjectRecords, type RejectedTeeProject } from '../src/tee/TeeProjectRecords'
import { UpstreamFallbackSettings } from '../src/tee/UpstreamFallbackSettings'
import { UpstreamJsonSource } from '../src/tee/UpstreamJsonSource'

const REMOTE = process.argv.includes('--remote')
const ALLOW_MASS_REMOVAL = process.argv.includes('--allow-mass-removal')

// Resolved from this file, not the cwd: `pnpm data:daily` runs from the repo root, nx from the lib.
const LIB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Live upstream input when one was fetched. Falls back to the frozen fixture so
// a local run works without fetching first.
const LIVE_PATH = resolve(LIB_ROOT, 'static/input/projects.json')
const FIXTURE_PATH = resolve(LIB_ROOT, 'static/input/projects-tests.json')

// Slug redirects (former → current). Falls back to the frozen fixture;
// absent → redirects step skipped.
const LIVE_REDIRECTS_PATH = resolve(LIB_ROOT, 'static/input/redirects.json')
const FIXTURE_REDIRECTS_PATH = resolve(LIB_ROOT, 'static/input/redirects-tests.json')

interface Inputs {
  records: TeeProject[]
  /** Upstream records set aside for a broken shape. */
  rejected: readonly RejectedTeeProject[]
  redirects: ProjectRedirects
}

/** Reads both inputs: from the upstream repository, or from `static/input/`. */
async function loadInputs(): Promise<Inputs> {
  if (!REMOTE) return { ...loadLocalRecords(), redirects: loadLocalRedirects() }

  const source = UpstreamJsonSource.fromSettings(UpstreamFallbackSettings.fromEnv())
  process.stdout.write(`Source distante : ${source.describe()}\n`)
  const records = await source.projects()
  const redirects = await source.redirects<unknown>()
  if (!redirects) process.stdout.write('Redirections : fichier amont absent, étape ignorée.\n')
  return { records, rejected: source.rejectedProjects, redirects: new ProjectRedirects(redirects ?? undefined) }
}

function loadLocalRecords(): Pick<Inputs, 'records' | 'rejected'> {
  const inputPath = existsSync(LIVE_PATH) ? LIVE_PATH : FIXTURE_PATH
  process.stdout.write(`Source : ${inputPath}\n`)
  // Same shape check as the remote read: a broken record is set aside, not fed to the import.
  const { projects, rejected } = TeeProjectRecords.parse(JSON.parse(readFileSync(inputPath, 'utf8')))
  return { records: projects, rejected }
}

function loadLocalRedirects(): ProjectRedirects {
  const path = existsSync(LIVE_REDIRECTS_PATH)
    ? LIVE_REDIRECTS_PATH
    : existsSync(FIXTURE_REDIRECTS_PATH)
      ? FIXTURE_REDIRECTS_PATH
      : undefined
  if (!path) {
    process.stdout.write('Redirections : aucun redirects.json, étape ignorée.\n')
    return new ProjectRedirects(undefined)
  }
  process.stdout.write(`Redirections : ${path}\n`)
  return new ProjectRedirects(JSON.parse(readFileSync(path, 'utf8')))
}

/**
 * The projects reference programs by the id derived from their slug: maps it to
 * the id each program is actually stored under, when the two differ.
 */
async function loadProgramIdentities(): Promise<CanonicalIdentityMap> {
  const stored = await (await createCanonicalProgramRepository()).listKeys()
  return CanonicalIdentityMap.fromSnapshot(
    stored,
    stored.map(({ slug }) => ({ id: SlugCanonicalId.from(slug), slug })),
  )
}

async function main(): Promise<void> {
  const { records, rejected, redirects } = await loadInputs()
  const repository = await createCanonicalProjectRepository()
  const service = new CanonicalProjectService(repository)

  // Phase 1: map every upstream record to a canonical input.
  const importer = new TeeProjectImporter()
  const inputs = importer.importMany(records, new Date().toISOString())
  const inputsBySlug = new Map(inputs.map((input) => [input.slug, input]))

  // Phase 2: apply redirects. Surviving former slugs are marked `remplace` in
  // place; former slugs no longer present get a `remplace` tombstone cloned from
  // their replacement, so a consumer holding them can follow on.
  const { tombstones, markedInPlace, skipped } = new ProjectTombstoneBuilder().build(redirects, inputsBySlug)
  inputs.push(...tombstones)

  // A record set aside for its shape goes in as a bare slug: the validator
  // refuses it, so its stored row is kept instead of removed as gone upstream.
  const rejectedSlugs = new Set(rejected.flatMap((record) => (record.slug === undefined ? [] : [record.slug])))
  for (const slug of rejectedSlugs) {
    if (!inputsBySlug.has(slug)) inputs.push({ slug } as CanonicalProjectInput)
  }

  // Phase 3: align the store on the snapshot: stored ids kept for known slugs,
  // validated, guarded, then deletions + upserts in one transaction.
  const guard = new CanonicalSnapshotGuard({
    entityLabel: 'projet',
    ...(ALLOW_MASS_REMOVAL ? { maxRemovalRatio: 1 } : {}),
  })
  const programIdentities = await loadProgramIdentities()
  const report = await service.applySnapshot(inputs, guard, { programIdentities })

  process.stdout.write(
    `\n✓ ${report.saved.toString()}/${inputs.length.toString()} projets écrits dans le store canonical\n`,
  )
  writeKeys('Retirés (absents de l\'amont)', report.removed)
  writeKeys('Conservés sous leur identifiant stocké (slug déjà connu)', report.adopted)
  writeKeys('Réidentifiés (identifiant stocké non conservable)', report.superseded)
  if (programIdentities.size > 0) {
    process.stdout.write(
      `Dispositifs référencés sous leur identifiant stocké : ${programIdentities.size.toString()}\n`,
    )
  }
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
    'Écartés (forme amont invalide)',
    rejected.map((record) => TeeProjectRecords.describe(record)),
  )
  writeList(
    'Ignorés (invalides)',
    report.invalid.filter((entry) => !rejectedSlugs.has(entry.slug)).map((entry) => entry.slug || '(slug manquant)'),
  )
  writeList('Avertissements du lecteur', [...importer.warnings])
}

function writeKeys(label: string, keys: CanonicalKey[]): void {
  writeList(label, keys.map((key) => key.slug))
}

function writeList(label: string, lines: string[]): void {
  if (lines.length === 0) return
  process.stdout.write(`${label} : ${lines.length.toString()}\n`)
  const preview = lines.slice(0, 20).map((line) => `  - ${line}`)
  process.stdout.write(`${preview.join('\n')}${lines.length > 20 ? '\n  …' : ''}\n`)
}

main().catch((err: unknown) => {
  process.stderr.write(`${String(err)}\n`)
  process.exit(1)
})
