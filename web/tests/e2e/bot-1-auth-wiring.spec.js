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

  test('login form does not prefill credentials', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('User ID or Email')).toHaveValue('')
    await expect(page.getByLabel('Password')).toHaveValue('')
  })

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
      await page.getByLabel(/Security Question 1/).fill(bot.securityAnswers[0])
      await page.getByLabel(/Security Question 2/).fill(bot.securityAnswers[1])
      await page.getByLabel(/Security Question 3/).fill(bot.securityAnswers[2])
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
        `/admin/users/${created.id}`,
        { actorUserId, status: 'active' },
        200,
      )

      await page.goto('/forgot-password')
      await expect(page.getByLabel('User ID or Email')).toHaveAttribute(
        'placeholder',
        'userId or email',
      )
      await expect(page.getByRole('button', { name: 'Load security questions' })).toBeVisible()
      await page.getByLabel('User ID or Email').fill(bot.gameName)
      await page.getByRole('button', { name: 'Load security questions' }).click()
      await expect(page.getByText('Security questions loaded')).toBeVisible()
      await page.getByLabel(/What was your first school name/).fill(bot.securityAnswers[0])
      await page.getByLabel(/Who is your favorite cricketer/).fill(bot.securityAnswers[1])
      await page.getByLabel(/What city were you born in/).fill(bot.securityAnswers[2])
      const uiNewPassword = 'demo1234'
      await page.getByLabel('New password').fill(uiNewPassword)
      await page.getByLabel('Confirm password').fill(uiNewPassword)
      await page.getByRole('button', { name: 'Update password' }).click()
      await expect(page.getByText('Password updated. Redirecting to login...')).toBeVisible()

      await loginUi(page, bot.gameName, uiNewPassword)
    } finally {
      await deleteUserIfPresent(request, bot.gameName)
    }
  })
})
