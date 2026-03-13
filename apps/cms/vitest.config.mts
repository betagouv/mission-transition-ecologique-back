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
      DATABASE_URI: 'file:./tee-pco-test.db',
      PAYLOAD_SECRET: 'test-secret-for-vitest',
    },
  },
})
