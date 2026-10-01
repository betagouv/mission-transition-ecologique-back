import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: '@tee-backoffice/canonical-store',
    globals: true,
    include: ['tests/**/*.spec.ts'],
    // The first test of each file boots PGlite (WASM Postgres): well over the
    // 5 s default on a CI runner that runs the three libraries side by side.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
