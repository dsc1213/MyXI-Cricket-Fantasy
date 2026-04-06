import { test, expect } from '@playwright/test'
import {
  deleteUserIfPresent,
  loginUi,
  registerAndActivateBot,
} from './helpers/mock-e2e.js'

test.describe('14) New user dashboard should not show pre-joined contests', () => {
  test('brand new approved user sees empty joined dashboard state', async ({ page, request }) => {
    const suffix = `${Date.now().toString().slice(-6)}`
    const bot = {
      name: 'battai',
      gameName: `mocke2ebot-battai-${suffix}`,
      email: `mocke2ebot-battai-${suffix}@myxi.local`,
      password: 'demo123',
      location: 'Hyderabad',
    }

    try {
      await registerAndActivateBot(request, bot)

      await loginUi(page, bot.gameName, bot.password)
      await page.goto('/home')

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
      await expect(page.getByText('No joined contests to show')).toBeVisible()
      await expect(page.locator('.joined-contest-grid .compact-contest-card')).toHaveCount(0)
    } finally {
      await deleteUserIfPresent(request, bot.gameName)
    }
  })

  test('joined contest cards render empty pts and rank without undefined text', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.route('**/contests?**', async (route) => {
      const url = new URL(route.request().url())
      if (url.searchParams.get('userId') !== 'master') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'joined-empty-metrics',
            tournamentId: 'ipl-2026',
            name: 'TEST IPL',
            game: 'Fantasy',
            status: 'Open',
            joined: true,
          },
        ]),
      })
    })

    await page.goto('/home')

    const card = page.locator('.joined-contest-grid .compact-contest-card', { hasText: 'TEST IPL' }).first()
    await expect(card).toBeVisible()
    await expect(card).toContainText('Pts ')
    await expect(card).toContainText('Rank #')
    await expect(card).not.toContainText('undefined')
    await expect(card).not.toContainText('#undefined')
  })
})
