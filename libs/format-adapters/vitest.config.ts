import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // Résout l'alias `@tee-backoffice/canonical` (paths du tsconfig de base) au runtime des tests.
  plugins: [tsconfigPaths()],
  test: {
    name: '@tee-backoffice/format-adapters',
    globals: true,
  },
})
