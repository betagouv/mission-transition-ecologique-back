import { getPayload } from 'payload'
import config from '@payload-config'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { GeographicAreasSeed } from './geographic-areas'
import { ProgramsSeed } from './programs'
import { ProjectsSeed } from './projects'
import { UsersSeed } from './users'
import { Config } from '@/config/Config'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const programsPath = resolve(dirname, '../../../../../docs/sources/programs.json')
const projectsPath = resolve(dirname, '../../../../../docs/sources/projects.json')

const payload = await getPayload({ config })
await new GeographicAreasSeed(payload).run()
await new ProgramsSeed(payload, programsPath).run()
await new ProjectsSeed(payload, projectsPath).run()
// The user fixtures use the email as password: never seed them in production,
// where the first super-admin is created by hand.
if (Config.isProduction()) {
  process.stdout.write('NODE_ENV=production : utilisateurs de dev non seedés.\n')
} else {
  await new UsersSeed(payload).run()
}
process.exit(0)
