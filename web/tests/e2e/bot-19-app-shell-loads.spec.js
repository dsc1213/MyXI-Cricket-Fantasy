import { expect, test } from '@playwright/test'

test('app shell boots on landing route', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'I already have an account' }),
  ).toBeVisible()
})
