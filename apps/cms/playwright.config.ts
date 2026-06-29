import { defineConfig, devices } from '@playwright/test'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    // Run from this package: there is no `dev` script in apps/cms, so invoke
    // next directly. In CI, serve the production build (the job runs `pnpm build`
    // first) for a faster, prod-like start; locally use dev for quick iteration.
    // Probe the login page (returns 200) rather than '/' (a redirect).
    command: process.env.CI
      ? 'pnpm exec next start -p 3000'
      : 'pnpm exec next dev -p 3000',
    url: 'http://localhost:3000/admin/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
