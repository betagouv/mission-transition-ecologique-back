// Canonical → Etalab schema → Grist export. Reads the canonical store, projects
// each exportable dispositif to the `dispositif-aide-professionnels` row (with
// the `technical` JSON column), writes a local snapshot, prints a recap of the
// schemas satisfied, then upserts into Grist — only if Grist is configured,
// otherwise it stays a dry run (no secret required to inspect the output).
//
// Run from the repo root: `nx run @tee-backoffice/format-adapters:export:grist`.
// By default it is a DRY RUN (build + snapshot + recap, no write). Add `--push`
// to upsert into Grist; that also needs GRIST_DOC_ID, GRIST_TABLE_ID,
// GRIST_API_KEY (and optionally GRIST_BASE_URL) to be set.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CanonicalProgramService } from '@tee-backoffice/canonical'
import { createCanonicalProgramRepository } from '@tee-backoffice/canonical-store'
import { GristExporter } from '../src/schema/GristExporter'
import { SCHEMA_CORE, SCHEMA_ENTREPRISE } from '../src/schema/schema-row.types'
import type { TechnicalData } from '../src/grist/grist.types'
import { GristConfig } from '../src/grist/GristConfig'
import { GristClient } from '../src/grist/GristClient'

const OUTPUT_PATH = resolve(process.cwd(), 'static/exports/grist-records.json')

function reportFit(records: { technical: string }[]): void {
  let core = 0
  let entreprise = 0
  for (const record of records) {
    const fitted = (JSON.parse(record.technical) as TechnicalData).fitted_schemas
    if (fitted.includes(SCHEMA_CORE)) core++
    if (fitted.includes(SCHEMA_ENTREPRISE)) entreprise++
  }
  process.stdout.write('\n=== Schémas satisfaits ===\n')
  process.stdout.write(`${SCHEMA_CORE} = ${core.toString()}/${records.length.toString()}\n`)
  process.stdout.write(`${SCHEMA_ENTREPRISE} = ${entreprise.toString()}/${records.length.toString()}\n`)
}

async function pushToGrist(records: Parameters<GristClient['upsertMany']>[0]): Promise<void> {
  // --push (CLI) or GRIST_PUSH=1 (CI, robust to nx arg forwarding) enables the write.
  if (!process.argv.includes('--push') && process.env['GRIST_PUSH'] !== '1') {
    process.stdout.write('\n(dry run — ajouter --push ou GRIST_PUSH=1 pour écrire dans Grist.)\n')
    return
  }
  const config = GristConfig.fromEnv()
  if (!config) {
    process.stderr.write('\n--push demandé mais Grist non configuré (GRIST_DOC_ID/GRIST_TABLE_ID/GRIST_API_KEY).\n')
    process.exit(1)
  }
  await new GristClient(config).upsertMany(records)
  process.stdout.write(`\n✓ ${records.length.toString()} dispositifs poussés vers Grist (${config.recordsUrl()})\n`)
}

async function main(): Promise<void> {
  const repository = await createCanonicalProgramRepository()
  const service = new CanonicalProgramService(repository)
  const programs = await service.getAll()
  const records = new GristExporter().exportMany(programs)

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(records, null, 2)}\n`)
  process.stdout.write(`\n✓ ${records.length.toString()} dispositifs exportables → ${OUTPUT_PATH}\n`)

  reportFit(records)
  await pushToGrist(records)
}

main().catch((err: unknown) => {
  process.stderr.write(`${String(err)}\n`)
  process.exit(1)
})
