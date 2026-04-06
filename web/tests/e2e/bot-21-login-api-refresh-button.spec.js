import { expect, test } from '@playwright/test'

test('login API refresh uses reusable button styling when API is unavailable', async ({
  page,
}) => {
  await page.route('**/health', async (route) => {
    await route.abort('failed')
  })

  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  const refreshButton = page.getByRole('button', { name: 'Refresh API status' })
  await expect(refreshButton).toBeVisible()
  await expect(refreshButton).toHaveClass(/btn/)
})

test('login API status section is hidden when API is connected', async ({ page }) => {
  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('.login-api-status-row')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Refresh API status' })).toHaveCount(0)
})
