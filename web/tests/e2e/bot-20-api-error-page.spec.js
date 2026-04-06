import { expect, test } from '@playwright/test'

test('does not show API error tile on landing page when health check fails', async ({
  page,
}) => {
  await page.route('**/health', async (route) => {
    await route.abort('failed')
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'API unavailable' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
})

test('shows reusable API error tile on authenticated body pages when health check fails', async ({
  page,
}) => {
  await page.route('**/health', async (route) => {
    await route.abort('failed')
  })

  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        userId: 'player',
        gameName: 'player',
        name: 'player',
        role: 'user',
        token: 'e2e-token',
        tokenExpiresAt: now + 60 * 60 * 1000,
      }),
    )
    window.localStorage.setItem('myxi-token', 'e2e-token')
  })

  await page.goto('/home', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'API unavailable' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry' }).first()).toBeVisible()
})
