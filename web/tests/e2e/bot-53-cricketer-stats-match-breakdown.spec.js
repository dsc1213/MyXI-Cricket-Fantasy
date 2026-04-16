import { expect, test } from '@playwright/test'

test('cricketer stats shows match-by-match score breakdown inline', async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        id: 1,
        userId: 'player',
        gameName: 'PlayerOne',
        name: 'Player One',
        role: 'user',
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

  await page.route('**/tournaments', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 't-1', name: 'IPL 2026' }]),
    })
  })

  await page.route('**/player-stats?tournamentId=t-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'p-7',
          name: 'Virat Kohli',
          team: 'RCB',
          teamCode: 'RCB',
          teamName: 'Royal Challengers Bengaluru',
          role: 'BAT',
          imageUrl: '',
          runs: 110,
          wickets: 0,
          catches: 3,
          fours: 12,
          sixes: 4,
          points: 167,
        },
      ]),
    })
  })

  await page.route('**/player-stats/p-7/breakdown?tournamentId=t-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          matchId: 'm-1',
          matchName: 'RCB vs MI',
          startTime: '2026-04-01T14:00:00.000Z',
          status: 'Completed',
          runs: 60,
          wickets: 0,
          catches: 1,
          points: 88,
        },
        {
          matchId: 'm-2',
          matchName: 'RCB vs CSK',
          startTime: '2026-04-05T14:00:00.000Z',
          status: 'Completed',
          runs: 50,
          wickets: 0,
          catches: 2,
          points: 79,
        },
      ]),
    })
  })

  await page.goto('/tournaments/t-1/cricketer-stats', { waitUntil: 'domcontentloaded' })

  const playerRow = page.locator('.cricketer-stats-table tbody tr', { hasText: 'Virat Kohli' })
  await expect(playerRow).toBeVisible()

  await playerRow.getByRole('button', { name: /Show match breakdown for Virat Kohli/i }).click()

  const breakdown = page.locator('.cricketer-breakdown-inline[data-player-id="p-7"]')
  await expect(breakdown).toBeVisible()
  await expect(breakdown).toContainText('RCB vs MI')
  await expect(breakdown).toContainText('RCB vs CSK')
  await expect(breakdown.locator('.cricketer-breakdown-total')).toContainText('110 runs')
  await expect(breakdown.locator('.cricketer-breakdown-total')).toContainText('3 ct')
  await expect(breakdown.locator('.cricketer-breakdown-total')).toContainText('167 pts')
})
