import { expect, test } from '@playwright/test'
import { deleteUserIfPresent, loginUi, registerAndActivateBot } from './helpers/mock-e2e.js'

test.describe('18) Forgot password via security Q&A', () => {
  test.setTimeout(120000)

  test('resets password when answers are correct', async ({ page, request }) => {
    const tag = `qa-pass-${Date.now()}`
    const bot = {
      name: 'QA Pass Bot',
      gameName: `mocke2ebot-${tag}`,
      email: `mocke2ebot-${tag}@myxi.local`,
      password: 'demo123',
      securityAnswers: ['pass-school', 'pass-cricketer', 'pass-city'],
    }
    const newPassword = 'demo1234'

    try {
      await deleteUserIfPresent(request, bot.gameName)
      await registerAndActivateBot(request, bot)

      await page.goto('/forgot-password')
      await page.getByLabel('User ID or Email').fill(bot.gameName)
      await page.getByRole('button', { name: 'Load security questions' }).click()
      await page.getByLabel(/What was your first school name/).fill(bot.securityAnswers[0])
      await page.getByLabel(/Who is your favorite cricketer/).fill(bot.securityAnswers[1])
      await page.getByLabel(/What city were you born in/).fill(bot.securityAnswers[2])
      await page.getByLabel('New password').fill(newPassword)
      await page.getByLabel('Confirm password').fill(newPassword)
      await page.getByRole('button', { name: 'Update password' }).click()
      await expect(page.getByText('Password updated. Redirecting to login...')).toBeVisible()

      await loginUi(page, bot.gameName, newPassword)
    } finally {
      await deleteUserIfPresent(request, bot.gameName)
    }
  })

  test('rejects reset when answers are wrong', async ({ page, request }) => {
    const tag = `qa-fail-${Date.now()}`
    const bot = {
      name: 'QA Fail Bot',
      gameName: `mocke2ebot-${tag}`,
      email: `mocke2ebot-${tag}@myxi.local`,
      password: 'demo123',
      securityAnswers: ['fail-school', 'fail-cricketer', 'fail-city'],
    }

    try {
      await deleteUserIfPresent(request, bot.gameName)
      await registerAndActivateBot(request, bot)

      await page.goto('/forgot-password')
      await page.getByLabel('User ID or Email').fill(bot.gameName)
      await page.getByRole('button', { name: 'Load security questions' }).click()
      await page.getByLabel(/What was your first school name/).fill('wrong-school')
      await page.getByLabel(/Who is your favorite cricketer/).fill('wrong-cricketer')
      await page.getByLabel(/What city were you born in/).fill('wrong-city')
      await page.getByLabel('New password').fill('demo1234')
      await page.getByLabel('Confirm password').fill('demo1234')
      await page.getByRole('button', { name: 'Update password' }).click()
      await expect(page.getByText('Security answers do not match')).toBeVisible()

      await loginUi(page, bot.gameName, bot.password)
    } finally {
      await deleteUserIfPresent(request, bot.gameName)
    }
  })
})
