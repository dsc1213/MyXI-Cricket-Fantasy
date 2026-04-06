import { expect, test } from '@playwright/test'
import {
  createBotUsers,
  deleteUserIfPresent,
  loginUi,
  logoutUi,
  PASSWORD,
  registerAndActivateBot,
} from './helpers/mock-e2e.js'

test.describe('17) Password update flow', () => {
  test.setTimeout(120000)

  test('user can change password and old password stops working', async ({ page, request }) => {
    const [bot] = createBotUsers(`pwd-${Date.now()}`)
    const nextPassword = 'demo1234'

    try {
      await deleteUserIfPresent(request, bot.gameName)
      await registerAndActivateBot(request, bot)

      await loginUi(page, bot.gameName, PASSWORD)
      await page.goto('/change-password')

      await page.getByLabel('Current password').fill(PASSWORD)
      await page.getByLabel('New password', { exact: true }).fill(nextPassword)
      await page.getByLabel('Confirm new password', { exact: true }).fill(nextPassword)
      await page.getByRole('button', { name: 'Update password' }).click()

      await expect(page.getByText('Password updated')).toBeVisible()

      await logoutUi(page)
      await page.goto('/login')
      await page.getByLabel('User ID or Email').fill(bot.gameName)
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page).toHaveURL(/\/login/)
      await expect(page.getByText('Invalid credentials')).toBeVisible()

      await loginUi(page, bot.gameName, nextPassword)
    } finally {
      await deleteUserIfPresent(request, bot.gameName)
    }
  })
})
