import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

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
      DATABASE_URI: process.env['TEST_DATABASE_URI'] ?? 'postgres://tee:tee@localhost:5432/tee_test',
      CANONICAL_DATABASE_URI:
        process.env['TEST_DATABASE_URI'] ?? 'postgres://tee:tee@localhost:5432/tee_test',
      PAYLOAD_SECRET: 'test-secret-for-vitest',
    },
  },
})
