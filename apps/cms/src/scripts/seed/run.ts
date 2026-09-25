import { getPayload } from 'payload'
import config from '@payload-config'
import { UpstreamJsonSource, type TeeRecord } from '@tee-backoffice/format-adapters'
import { GeographicAreasSeed } from './geographic-areas'
import { ProgramsSeed } from './programs'
import { ProjectsSeed } from './projects'
import type { SourceProject } from './projects/types'
import { UsersSeed } from './users'
import { Config } from '@/config/Config'

// Upstream GitHub files are the source of truth; the versioned local copy is a
// development fallback only, production fails instead.
const source = UpstreamJsonSource.forEnvironment(Config.isProduction())
process.stdout.write(`Source : ${source.describe()}\n`)
const programs = await source.programs<TeeRecord[]>()
const projects = await source.projects<SourceProject[]>()

const payload = await getPayload({ config })
await new GeographicAreasSeed(payload).run()
await new ProgramsSeed(payload, programs).run()
await new ProjectsSeed(payload, projects).run()
// The user fixtures use the email as password: never seed them in production,
// where the first super-admin is created by hand.
if (Config.isProduction()) {
  process.stdout.write('NODE_ENV=production : utilisateurs de dev non seedés.\n')
} else {
  await new UsersSeed(payload).run()
}
process.exit(0)
