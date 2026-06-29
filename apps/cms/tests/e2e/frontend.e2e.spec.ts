import { test, expect } from '@playwright/test'

test.describe('Frontend', () => {
  // There is no public frontend: next.config redirects '/' to '/admin', which in
  // turn redirects an unauthenticated visitor to the admin login page.
  test('root redirects to the admin login', async ({ page }) => {
    await page.goto('http://localhost:3000')

    await expect(page).toHaveURL(/\/admin(\/login)?/)
    await expect(page.locator('#field-email')).toBeVisible()
  })
})
