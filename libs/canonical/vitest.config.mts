import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: '@tee-backoffice/canonical',
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
})
