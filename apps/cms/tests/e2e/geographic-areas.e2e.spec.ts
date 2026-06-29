import type { Page } from '@playwright/test'
import { test, expect } from '@playwright/test'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

const ADMIN_URL = 'http://localhost:3000/admin'

// Counts mirror the geographic-areas seed fixtures.
const METRO_REGIONS = 13
const ALL_REGIONS = 25
const METRO_DEPARTEMENTS = 96
const ALL_DEPARTEMENTS = 101

const areaChips = (page: Page) =>
  page.locator('.field--geographic-areas .rs__multi-value')

/**
 * Selects a value in a Payload react-select field by visible option text.
 */
async function selectOption(
  page: Page,
  fieldId: string,
  optionText: string,
): Promise<void> {
  await page.locator(`#field-${fieldId} .rs__control`).click()
  await page
    .locator('.rs__option', { hasText: optionText })
    .filter({ hasText: optionText })
    .first()
    .click()
}

test.describe('Programs — bulk geographic area selection', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test.beforeEach(async () => {
    await page.goto(`${ADMIN_URL}/collections/programs/create`)
    await expect(page.locator('#field-geographicCoverage')).toBeVisible()
  })

  test('buttons are hidden until coverage is regional or departemental', async () => {
    await expect(
      page.getByRole('button', { name: 'Toutes les régions métropole' }),
    ).toHaveCount(0)
  })

  test('regional coverage: metropole, all and clear buttons', async () => {
    await selectOption(page, 'geographicCoverage', 'Régional')

    const metropole = page.getByRole('button', {
      name: 'Toutes les régions métropole',
    })
    const all = page.getByRole('button', {
      name: 'Toutes les régions (métropole + outre-mer)',
    })
    const clear = page.getByRole('button', { name: 'Vider la sélection' })

    await expect(metropole).toBeVisible()
    await expect(all).toBeVisible()

    await metropole.click()
    await expect(areaChips(page)).toHaveCount(METRO_REGIONS)

    await all.click()
    await expect(areaChips(page)).toHaveCount(ALL_REGIONS)

    await clear.click()
    await expect(areaChips(page)).toHaveCount(0)
  })

  test('departemental coverage selects 96 vs 101 departments', async () => {
    await selectOption(page, 'geographicCoverage', 'Départemental')

    await page
      .getByRole('button', { name: 'Tous les départements métropole' })
      .click()
    await expect(areaChips(page)).toHaveCount(METRO_DEPARTEMENTS)

    await page
      .getByRole('button', {
        name: 'Tous les départements (métropole + outre-mer)',
      })
      .click()
    await expect(areaChips(page)).toHaveCount(ALL_DEPARTEMENTS)
  })
})
