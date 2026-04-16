import { expect, test } from '@playwright/test'

test('contest removal confirm accepts trimmed case-insensitive match', async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        id: 1,
        userId: 'master',
        gameName: 'master',
        name: 'Master Admin',
        role: 'master_admin',
        token: 'e2e-token',
        tokenExpiresAt: now + 12 * 60 * 60 * 1000,
      }),
    )
    window.localStorage.setItem('myxi-token', 'e2e-token')
  })

  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route('**/tournaments/t-1/contests/c-1**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.continue()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'c-1',
        tournamentId: 't-1',
        tournamentName: 'IPL 2026',
        name: 'Mega Finals',
        game: 'Fantasy',
        status: 'Open',
        lastScoreUpdatedAt: '',
        lastScoreUpdatedBy: '',
      }),
    })
  })

  await page.route('**/contests/c-1/matches**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/contests/c-1/participants**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ participants: [], joinedCount: 0, previewXI: [] }),
    })
  })

  await page.route('**/contests/c-1/leaderboard**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rows: [] }),
    })
  })

  await page.route('**/admin/contests/c-1/removal-preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contestName: 'Mega Finals',
        matchCount: 2,
        joinedCount: 8,
        teamSelectionsCount: 8,
        fixedRostersCount: 0,
        contestScoresCount: 0,
      }),
    })
  })

  await page.route('**/admin/contests/c-1/remove', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.goto('/tournaments/t-1/contests/c-1', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: 'Remove contest' }).click()

  const removeButton = page.getByRole('button', { name: 'Remove', exact: true })
  await expect(removeButton).toBeDisabled()

  await page.getByRole('textbox').fill('  MEGA FINALS  ')
  await expect(removeButton).toBeEnabled()
})
