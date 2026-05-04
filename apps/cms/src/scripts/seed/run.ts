import { getPayload } from 'payload'
import config from '@payload-config'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { GeographicAreasSeed } from './geographic-areas'
import { ProgramsSeed } from './programs'
import { ProjectsSeed } from './projects'
import { UsersSeed } from './users'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const programsPath = resolve(dirname, '../../../../../docs/sources/programs.json')
const projectsPath = resolve(dirname, '../../../../../docs/sources/projects.json')

const payload = await getPayload({ config })
await new GeographicAreasSeed(payload).run()
await new ProgramsSeed(payload, programsPath).run()
await new ProjectsSeed(payload, projectsPath).run()
await new UsersSeed(payload).run()
process.exit(0)
