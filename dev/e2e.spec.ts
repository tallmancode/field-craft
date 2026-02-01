import { expect, test } from '@playwright/test'

test('should render admin panel logo', async ({ page }) => {
  await page.goto('/admin')

  // login
  await page.fill('#field-email', 'dev@payloadcms.com')
  await page.fill('#field-password', 'test')
  await page.click('.form-submit button')

  // should show dashboard
  await expect(page).toHaveTitle(/Dashboard/)
  await expect(page.locator('.graphic-icon')).toBeVisible()
})

test('Media collection shows FieldCraft AI suggestions UI', async ({ page }) => {
  await page.goto('/admin')

  await page.fill('#field-email', 'dev@payloadcms.com')
  await page.fill('#field-password', 'test')
  await page.click('.form-submit button')

  await page.goto('/admin/collections/media/create')
  await expect(page).toHaveTitle(/Media/)

  // Plugin adds AI suggestions field in sidebar; look for indicative text
  await expect(
    page.getByText(/AI|suggestions|Suggest/i).first(),
  ).toBeVisible({ timeout: 10_000 })
})
