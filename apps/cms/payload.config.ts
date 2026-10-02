import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { s3Storage } from '@payloadcms/storage-s3'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'
import { fr } from '@payloadcms/translations/languages/fr'
import { Users } from '@/collections/Users'
import { Media } from '@/collections/Media'
import { Operators } from '@/collections/Operators'
import { OperatorGroups } from '@/collections/OperatorGroups'
import { Programs } from '@/collections/Programs'
import { Projects } from '@/collections/Projects'
import { GeographicAreas } from '@/collections/GeographicAreas'
import { ReviewComments } from '@/collections/ReviewComments'
import { agirProgramEndpoints } from '@/endpoints/agir/agirProgramEndpoints'
import { agirProjectEndpoints } from '@/endpoints/agir/agirProjectEndpoints'
import { migrations } from '@/migrations'
import { Config } from '@/config/Config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Scalingo's filesystem is throwaway, so Media uploads go to object storage
// (Scaleway, S3 API). Without a configured bucket (development), the plugin is
// disabled and Payload keeps its local disk storage. Registered as a plugin:
// this Payload version has no top-level `storage` key yet.
const objectStorage = Config.objectStorage()
const storagePlugin = s3Storage({
  enabled: Boolean(objectStorage),
  // The plugin adds its own columns to `media` (`prefix`, `_objectKey`): keep
  // them in every environment so migrations generated locally match production.
  alwaysInsertFields: true,
  // Media files are public and their URL points straight to the bucket, which
  // serves them through a per-object public-read ACL (ADR 0013).
  acl: 'public-read',
  collections: { media: { disablePayloadAccessControl: true } },
  bucket: objectStorage?.bucket ?? '',
  config: objectStorage
    ? {
        endpoint: objectStorage.endpoint,
        region: objectStorage.region,
        credentials: {
          accessKeyId: objectStorage.accessKeyId,
          secretAccessKey: objectStorage.secretAccessKey,
        },
      }
    : {},
})

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
  collections: [
    Users,
    Media,
    Operators,
    OperatorGroups,
    Programs,
    Projects,
    GeographicAreas,
    ReviewComments,
  ],
  endpoints: [...agirProgramEndpoints, ...agirProjectEndpoints],
  editor: lexicalEditor(),
  secret: Config.payloadSecret(),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Payload owns the `public` schema; the canonical store lives in its own
  // `canonical` schema of the same database (ADR 0012). Schema changes are
  // pushed automatically in dev only; elsewhere they ship as migrations.
  db: postgresAdapter({
    pool: {
      connectionString: Config.databaseUrl(),
      max: Config.databasePoolMax(),
    },
    migrationDir: path.resolve(dirname, 'src/migrations'),
    // Applied on server start when NODE_ENV=production (no postdeploy step).
    prodMigrations: migrations,
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
  plugins: [storagePlugin],
})
