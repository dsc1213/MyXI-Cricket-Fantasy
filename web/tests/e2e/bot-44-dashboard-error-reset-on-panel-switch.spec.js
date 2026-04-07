import { expect, test } from '@playwright/test'
import { loginUi } from './helpers/mock-e2e.js'

const MASTER_LOGIN =
  process.env.PW_E2E_MASTER_LOGIN || process.env.PW_DB_MASTER_LOGIN || 'master'

test('dashboard shared error banner resets when switching panels', async ({ page }) => {
  await loginUi(page, MASTER_LOGIN)
  await page.goto('/home?panel=scoreManager')

  await expect(page.getByRole('heading', { name: /Score Manager/i })).toBeVisible()

  // Trigger a predictable dashboard-level error in score manager.
  await page.getByRole('button', { name: 'Generate JSON' }).click()
  await expect(
    page.getByText('Select tournament and match before generating JSON'),
  ).toBeVisible()

  // Switch to another panel and ensure the previous error is not carried forward.
  await page.getByRole('button', { name: 'Player Manager' }).click()
  await expect(page.getByRole('heading', { name: 'Player Manager' })).toBeVisible()
  await expect(
    page.getByText('Select tournament and match before generating JSON'),
  ).toHaveCount(0)
})
