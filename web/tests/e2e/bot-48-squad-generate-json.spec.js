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
  await expect(page.locator('.squad-manager-json-team-name')).toContainText(
    'Chennai Super Kings',
  )

  const jsonTextarea = page.locator('.squad-manager-json-textarea')
  await expect(jsonTextarea).toBeVisible()
  await generateButton.click()
  const modal = page.locator('.score-preview-modal', {
    has: page.getByRole('heading', { name: 'Generated Squad JSON' }),
  })
  await expect(modal).toBeVisible()
  await expect(modal.getByText('AI Prompt For Squad JSON')).toBeVisible()
  await expect(modal.locator('.score-preview-textarea-prompt')).toContainText(
    '/admin/team-squads',
  )
  await modal.getByRole('button', { name: 'Use Template' }).click()
  await expect(jsonTextarea).toContainText('"teamSquads": [')
  await expect(jsonTextarea).toContainText('"source": "json"')
  await expect(jsonTextarea).toContainText('"teamName":')
})

test('squad manager json upload asks before adding missing players', async ({ page }) => {
  const tag = Date.now()
  await loginUi(page, 'master')
  await page.goto('/home?panel=squads')

  const doneButton = page.getByRole('button', { name: 'Done' })
  if ((await doneButton.count()) === 0) {
    await page.getByRole('button', { name: 'Edit squad' }).click()
  }
  await page.getByRole('tab', { name: 'JSON' }).click()

  await page.locator('.squad-manager-json-textarea').fill(
    JSON.stringify(
      {
        tournamentId: `missing-player-${tag}`,
        tournament: `Missing Player ${tag}`,
        country: 'usa',
        league: 'MLC',
        teamSquads: [
          {
            teamCode: 'ZZZ',
            teamName: 'Missing Player Team',
            tournamentId: `missing-player-${tag}`,
            tournament: `Missing Player ${tag}`,
            squad: [
              {
                name: `Missing Squad Player ${tag}`,
                country: 'usa',
                role: 'BAT',
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  )

  await page.getByRole('button', { name: 'Save squad' }).click()
  const modal = page.getByRole('dialog', { name: 'Add Missing Players?' })
  await expect(modal).toBeVisible()
  await expect(modal).toContainText(`Missing Squad Player ${tag}`)
  await expect(modal.getByRole('button', { name: 'Add 1 and save' })).toBeVisible()
})
