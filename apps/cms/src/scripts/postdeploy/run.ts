import { spawnSync } from 'node:child_process'
import { Config } from '@/config/Config'
import { DatabaseSchemaReset } from './DatabaseSchemaReset'

// Scalingo `postdeploy` hook, shared by every app through the Procfile: a no-op
// unless TEE_RESET_DATABASE_ON_DEPLOY=1 is set on the app (preprod only).
const settings = Config.deployDatabaseReset()
process.stdout.write(`Postdeploy : ${settings.describe()}.\n`)
if (!settings.isEnabled()) process.exit(0)

await new DatabaseSchemaReset(Config.databaseUrl()).run()
process.stdout.write('Schémas public et canonical supprimés. Seed...\n')

// The seed is its own entrypoint (it exits the process); in production its
// Payload init applies the migrations first on the empty schema.
const seed = spawnSync('tsx', ['src/scripts/seed/run.ts'], { stdio: 'inherit' })
process.exit(seed.status ?? 1)
