import { getPayload } from 'payload'
import config from '@payload-config'
import { UpstreamSnapshot } from './UpstreamSnapshot'
import { UpstreamSync } from './UpstreamSync'

// Entry point of `pnpm data:sync`, the first step of the daily job: aligns the
// CMS on upstream, the canonical stores following through the collection hooks.
// `--allow-mass-removal` lifts the ceiling on cancellations and withdrawals.
const snapshot = await UpstreamSnapshot.fetch()
const payload = await getPayload({ config })
const report = await new UpstreamSync(payload, snapshot, {
  allowMassRemoval: process.argv.includes('--allow-mass-removal'),
}).run()

// A partial sync must fail the job rather than pass unnoticed.
if (report.errors > 0) process.stderr.write(`Synchronisation incomplète : ${report.errors.toString()} erreur(s).\n`)
process.exit(report.errors > 0 ? 1 : 0)
