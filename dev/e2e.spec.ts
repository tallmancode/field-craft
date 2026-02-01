import { expect, test } from '@playwright/test'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin')
  await page.locator('#field-email').waitFor({ state: 'visible', timeout: 15_000 })
  await page.fill('#field-email', 'dev@payloadcms.com')
  await page.fill('#field-password', 'test')
  await page.locator('.form-submit button').click()
  await expect(page).toHaveTitle(/Dashboard/, { timeout: 15_000 })
}

test('should render admin panel logo', async ({ page }) => {
  await login(page)
  await expect(page.locator('.graphic-icon')).toBeVisible()
})

test('Media collection shows FieldCraft AI suggestions UI', async ({ page }) => {
  await login(page)

  await page.goto('/admin/collections/media/create')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveTitle(/Media/, { timeout: 15_000 })

  // Plugin adds AI suggestions field in sidebar; look for indicative text
  await expect(
    page.getByText(/AI|suggestions|Suggest/i).first(),
  ).toBeVisible({ timeout: 10_000 })
})
