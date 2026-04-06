import { expect, test } from '@playwright/test'
import { loginUi } from './helpers/mock-e2e.js'

test.describe('Home page smoke', () => {
  test('renders dashboard shell on /home', async ({ page }) => {
    await loginUi(page, 'player')
    await page.goto('/home')

    await expect(page.getByRole('navigation').getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Scoring Rules' })).toBeVisible()
  })
})
