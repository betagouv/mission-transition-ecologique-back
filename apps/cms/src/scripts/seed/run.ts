import { getPayload } from 'payload'
import config from '@payload-config'
import {
  TeeProjectRecords,
  UpstreamAssetSource,
  UpstreamJsonSource,
  type TeeRecord,
} from '@tee-backoffice/format-adapters'
import { GeographicAreasSeed } from './geographic-areas'
import { UpstreamMediaImporter } from './media/UpstreamMediaImporter'
import { ProgramsSeed } from './programs'
import { ProjectsSeed } from './projects'
import { UsersSeed } from './users'
import { Config } from '@/config/Config'

// Upstream GitHub files are the source of truth; the versioned local copy is an
// opt-in development fallback, refused on Scalingo.
const source = UpstreamJsonSource.fromSettings(Config.upstreamFallback())
// Logos and project images are never versioned locally: with the local fallback,
// their downloads fail and are reported as warnings.
const assets = new UpstreamAssetSource()
process.stdout.write(`Source : ${source.describe()}\n`)
process.stdout.write(`Fichiers : ${assets.describe()}\n`)
const [programs, projects, operators] = await Promise.all([
  source.programs<TeeRecord[]>(),
  source.projects(),
  source.operators(),
])
// A broken upstream record is set aside, the others are still seeded: it counts as an error below.
const rejectedProjects = source.rejectedProjects

const payload = await getPayload({ config })
const media = new UpstreamMediaImporter(payload, assets)
await new GeographicAreasSeed(payload).run()
const programsResult = await new ProgramsSeed(payload, programs, { operators, media }).run()
const projectsResult = await new ProjectsSeed(payload, projects, media).run()
// The user fixtures use the email as password: in production they need the
// explicit TEE_SEED_DEV_USERS opt-in (preprod, first prod deploy).
if (Config.seedsDevUsers()) {
  await new UsersSeed(payload).run()
} else {
  process.stdout.write('NODE_ENV=production sans TEE_SEED_DEV_USERS : utilisateurs de dev non seedés.\n')
}
const { created, reused, recategorized, failed } = media.stats
process.stdout.write(
  `Médias : ${created.toString()} créés, ${reused.toString()} réutilisés (dont ${recategorized.toString()} recatégorisés), ${failed.toString()} en échec.\n`,
)
// A missing file is reported, not fatal: the document is kept without its image.
for (const [warning, count] of media.warnings) {
  process.stdout.write(`  ⚠ ${count.toString()} × ${warning}\n`)
}
// A partial seed must fail the job (CI, deployment) rather than pass unnoticed.
if (rejectedProjects.length > 0) {
  process.stderr.write(`Projets amont écartés (${rejectedProjects.length.toString()}) :\n`)
  for (const rejected of rejectedProjects) process.stderr.write(`  ✗ ${TeeProjectRecords.describe(rejected)}\n`)
}
const errors = programsResult.errors + projectsResult.errors + rejectedProjects.length
if (errors > 0) process.stderr.write(`Seed incomplet : ${errors.toString()} erreur(s).\n`)
process.exit(errors > 0 ? 1 : 0)
