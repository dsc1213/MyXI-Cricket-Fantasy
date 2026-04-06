import { expect, test } from '@playwright/test'

test('deep link refresh keeps SPA route and does not show host-level 404 page', async ({
  page,
}) => {
  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        userId: 'player',
        gameName: 'player',
        name: 'Player',
        role: 'user',
        token: 'e2e-token',
        tokenExpiresAt: now + 60 * 60 * 1000,
      }),
    )
    window.localStorage.setItem('myxi-token', 'e2e-token')
  })

  await page.goto('/home', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/home/)
  await expect(page.locator('body')).not.toContainText('404: NOT_FOUND')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
