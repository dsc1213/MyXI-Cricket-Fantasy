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
})

