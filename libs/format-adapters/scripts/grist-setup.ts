// One-shot Grist bootstrap: tests the connection, creates the target table if
// it doesn't exist, and aligns its columns on the Etalab schema (adds missing
// columns; with --prune, also removes Grist's default A/B/C columns). Idempotent
// — safe to re-run. Needed because neither `export:grist --push` nor the
// data.gouv widget creates columns; they assume the table already exists.
//
// Run from the repo root:
//   nx run @tee-backoffice/format-adapters:setup:grist
//   nx run @tee-backoffice/format-adapters:setup:grist -- --prune
//
// Skipped when GRIST_API_KEY is absent (Grist disabled); otherwise requires
// GRIST_DOC_ID and GRIST_TABLE_ID (and optionally GRIST_BASE_URL) in the environment / .env.
import { GristConfig } from '../src/grist/GristConfig'
import { GristTableManager } from '../src/grist/GristTableManager'

async function main(): Promise<void> {
  const config = GristConfig.fromEnv()
  if (!config) {
    process.stdout.write('Grist désactivé (GRIST_API_KEY absente) : préparation de la table ignorée.\n')
    return
  }

  const manager = new GristTableManager(config)
  const tables = await manager.listTableIds()
  process.stdout.write(`Connexion Grist OK (${config.apiBase()}). Tables : ${tables.join(', ') || '(aucune)'}\n`)

  const prune = process.argv.includes('--prune')
  const result = await manager.prepareTable({ pruneExtraColumns: prune })

  process.stdout.write(`\nTable « ${result.tableId} » : ${result.created ? 'créée' : 'déjà présente'}\n`)
  process.stdout.write(`Colonnes ajoutées (${result.added.length.toString()}) : ${result.added.join(', ') || '(aucune)'}\n`)
  process.stdout.write(
    `Colonnes supprimées (${result.removed.length.toString()}) : ${result.removed.join(', ') || '(aucune)'}${prune ? '' : ' — --prune non demandé'}\n`,
  )
}

main().catch((err: unknown) => {
  process.stderr.write(`${String(err)}\n`)
  process.exit(1)
})
