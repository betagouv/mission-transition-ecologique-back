import { getPayload } from 'payload'
import config from '@payload-config'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { ProgramsSeed } from './programs'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const programsPath = resolve(dirname, '../../../../docs/sources/programs.json')

const payload = await getPayload({ config })
await new ProgramsSeed(payload, programsPath).run()
process.exit(0)
