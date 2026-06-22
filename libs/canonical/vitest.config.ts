import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@tee-backoffice/canonical',
    globals: true,
    include: ['tests/**/*.spec.ts'],
  },
})
