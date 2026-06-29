import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: '@tee-backoffice/canonical-store',
    globals: true,
    include: ['tests/**/*.spec.ts'],
  },
})
