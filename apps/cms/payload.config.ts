import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import { fr } from '@payloadcms/translations/languages/fr'
import { Users } from '@/collections/Users'
import { Media } from '@/collections/Media'
import { Operators } from '@/collections/Operators'
import { Programs } from '@/collections/Programs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Operators, Programs],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./tee-poc.db',
    },
  }),
  i18n: {
    fallbackLanguage: 'en',
    supportedLanguages:  { fr },
  },
  plugins: [],
})
