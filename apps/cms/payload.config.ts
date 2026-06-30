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
import { Projects } from '@/collections/Projects'
import { GeographicAreas } from '@/collections/GeographicAreas'
import { agirEndpoints } from '@/endpoints/agir/agirEndpoints'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    theme: 'light',
    // French date/time format (date-fns pattern) used as the admin-wide default,
    // e.g. for the document versions list. Day-only fields override it with
    // their own `admin.date.displayFormat`.
    dateFormat: 'dd/MM/yyyy HH:mm',
    meta: {
      icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/favicon.svg' }],
    },
    components: {
      graphics: {
        Logo: '@/components/admin/Logo#Logo',
        Icon: '@/components/admin/Icon#Icon',
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Operators, Programs, Projects, GeographicAreas],
  endpoints: agirEndpoints,
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
    supportedLanguages: { fr },
    translations: {
      fr: {
        general: {
          createNew: 'Créer un nouveau',
          createNewLabel: 'Créer un nouveau {{label}}',
          creatingNewLabel: 'Création d’un nouveau {{label}}',
        },
      },
    },
  },
  plugins: [],
})
