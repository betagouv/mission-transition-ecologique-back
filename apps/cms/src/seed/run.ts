import { getPayload } from 'payload'
import config from '../../payload.config'
import { seedPrograms } from './programs'

const payload = await getPayload({ config })
await seedPrograms(payload)
process.exit(0)
