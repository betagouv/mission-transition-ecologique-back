import { getPayload } from 'payload'
import config from '@payload-config'
import { UpstreamSnapshot } from '../sync/UpstreamSnapshot'
import { UpstreamSync } from '../sync/UpstreamSync'
import { GeographicAreasSeed } from './geographic-areas'
import { UsersSeed } from './users'
import { Config } from '@/config/Config'

// The upstream part of the seed is the daily sync itself (`UpstreamSync`): a
// seeded database and a synced one hold the same thing.
const snapshot = await UpstreamSnapshot.fetch()

const payload = await getPayload({ config })
await new GeographicAreasSeed(payload).run()
const report = await new UpstreamSync(payload, snapshot).run()
// The user fixtures use the email as password: in production they need the
// explicit TEE_SEED_DEV_USERS opt-in (preprod, first prod deploy).
if (Config.seedsDevUsers()) {
  await new UsersSeed(payload).run()
} else {
  process.stdout.write('NODE_ENV=production sans TEE_SEED_DEV_USERS : utilisateurs de dev non seedés.\n')
}
// A partial seed must fail the job (CI, deployment) rather than pass unnoticed.
if (report.errors > 0) process.stderr.write(`Seed incomplet : ${report.errors.toString()} erreur(s).\n`)
process.exit(report.errors > 0 ? 1 : 0)
