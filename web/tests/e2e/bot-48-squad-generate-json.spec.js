import { expect, test } from '@playwright/test'
import { loginUi } from './helpers/mock-e2e.js'

test('squad manager json mode has generate json button and fills payload', async ({
  page,
}) => {
  await loginUi(page, 'master')
  await page.goto('/home?panel=squads')

  const doneButton = page.getByRole('button', { name: 'Done' })
  if ((await doneButton.count()) === 0) {
    await page.getByRole('button', { name: 'Edit squad' }).click()
  }
  await expect
    .poll(async () => page.getByRole('tab', { name: 'JSON' }).count(), { timeout: 15000 })
    .toBeGreaterThan(0)
  const jsonTab = page.getByRole('tab', { name: 'JSON' })
  await expect(jsonTab).toBeVisible()
  await jsonTab.click()

  const generateButton = page.getByRole('button', { name: 'Generate JSON' })
  await expect(generateButton).toBeVisible()

  const jsonTextarea = page.locator('.squad-manager-json-textarea')
  await expect(jsonTextarea).toBeVisible()
  await generateButton.click()
  await expect(jsonTextarea).toContainText('"teamSquads": [')
  await expect(jsonTextarea).toContainText('"source": "json"')
})
