import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { TEST_DATABASE_URL } from './tests/support/testDatabaseUrl'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globalSetup: ['./vitest.global-setup.ts'],
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
    include: ['tests/int/**/*.int.spec.ts'],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    teardownTimeout: 30_000,
    env: {
      // Dedicated test database (created by docker-compose next to `tee`), wiped
      // by vitest.global-setup.ts: a test run never touches the dev data. The
      // canonical store shares it, in its own `canonical` schema.
      DATABASE_URI: TEST_DATABASE_URL,
      CANONICAL_DATABASE_URI: TEST_DATABASE_URL,
      PAYLOAD_SECRET: 'test-secret-for-vitest',
      // Uploads made by the tests stay on local disk, never in a real bucket from `.env`.
      S3_BUCKET: '',
    },
  },
})
