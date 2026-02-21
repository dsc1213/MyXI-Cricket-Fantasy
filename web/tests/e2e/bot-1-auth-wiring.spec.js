import { expect, test } from '@playwright/test'
import {
  apiCall,
  createBotUsers,
  deleteUserIfPresent,
  findUserByGameName,
  getMasterActorUserId,
  loginUi,
  PASSWORD,
} from './helpers/mock-e2e.js'

test.describe('1) Auth wiring', () => {
  test.setTimeout(120000)

  test('get started signup, login, forgot password, reset password', async ({ page, request }) => {
    const [bot] = createBotUsers(`auth-${Date.now()}`)

    try {
      await deleteUserIfPresent(request, bot.gameName)

      await page.goto('/')
      await page.getByRole('link', { name: 'Get Started' }).click()
      await expect(page).toHaveURL(/\/register/)

      await page.getByLabel('Full name').fill(bot.name)
      await page.getByLabel('Game name').fill(bot.gameName)
      await page.getByLabel('Email').fill(bot.email)
      await page.getByLabel('Location').fill('Hyderabad')
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByRole('button', { name: 'Submit for approval' }).click()
      await expect(page).toHaveURL(/\/pending/, { timeout: 15000 })

      await page.goto('/login')
      await page.getByLabel('User ID or Email').fill(bot.gameName)
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await expect(page).toHaveURL(/\/pending/, { timeout: 15000 })

      const actorUserId = await getMasterActorUserId(request)
      const created = await findUserByGameName(request, bot.gameName)
      await apiCall(
        request,
        'PATCH',
        `/mock/admin/users/${created.id}`,
        { actorUserId, status: 'active' },
        200,
      )

      await loginUi(page, bot.gameName, PASSWORD)
      const forgotRes = await apiCall(
        request,
        'POST',
        '/auth/forgot-password',
        { userId: bot.gameName },
        200,
      )
      const token = forgotRes?.resetToken
      expect(token).toBeTruthy()

      const newPassword = 'demo1234'
      await apiCall(
        request,
        'POST',
        '/auth/reset-password',
        { token, newPassword },
        200,
      )

      await loginUi(page, bot.gameName, newPassword)
    } finally {
      await deleteUserIfPresent(request, bot.gameName)
    }
  })
})
