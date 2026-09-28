import { getPayload } from 'payload'
import config from '@payload-config'
import { UpstreamJsonSource, type TeeRecord } from '@tee-backoffice/format-adapters'
import { GeographicAreasSeed } from './geographic-areas'
import { ProgramsSeed } from './programs'
import { ProjectsSeed } from './projects'
import type { SourceProject } from './projects/types'
import { UsersSeed } from './users'
import { Config } from '@/config/Config'

// Upstream GitHub files are the source of truth; the versioned local copy is an
// opt-in development fallback, refused on Scalingo.
const source = UpstreamJsonSource.fromSettings(Config.upstreamFallback())
process.stdout.write(`Source : ${source.describe()}\n`)
const programs = await source.programs<TeeRecord[]>()
const projects = await source.projects<SourceProject[]>()

const payload = await getPayload({ config })
await new GeographicAreasSeed(payload).run()
const programsResult = await new ProgramsSeed(payload, programs).run()
const projectsResult = await new ProjectsSeed(payload, projects).run()
// The user fixtures use the email as password: in production they need the
// explicit TEE_SEED_DEV_USERS opt-in (preprod, first prod deploy).
if (Config.seedsDevUsers()) {
  await new UsersSeed(payload).run()
} else {
  process.stdout.write('NODE_ENV=production sans TEE_SEED_DEV_USERS : utilisateurs de dev non seedés.\n')
}
// A partial seed must fail the job (CI, deployment) rather than pass unnoticed.
const errors = programsResult.errors + projectsResult.errors
if (errors > 0) process.stderr.write(`Seed incomplet : ${errors.toString()} erreur(s).\n`)
process.exit(errors > 0 ? 1 : 0)
