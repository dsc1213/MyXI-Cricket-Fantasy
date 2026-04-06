import { expect, test } from '@playwright/test'

test('fantasy classifies hasTeam contest as joined even when joined flag is false', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        id: 101,
        userId: 'bot-team-user',
        gameName: 'bot-team-user',
        name: 'Team Bot',
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
      body: JSON.stringify([{ id: 't-ipl', name: 'IPL 2026' }]),
    })
  })

  await page.route('**/contests**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'c-team-1',
          tournamentId: 't-ipl',
          name: 'Team Added Contest',
          game: 'Fantasy',
          mode: 'classic',
          status: 'In Progress',
          joined: false,
          hasTeam: true,
          joinedCount: 2,
          maxPlayers: 10,
        },
      ]),
    })
  })

  await page.goto('/fantasy', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'Joined (1)' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Available (0)' })).toBeVisible()

  const joinedSection = page
    .locator('.contest-section-head')
    .filter({ has: page.getByRole('heading', { name: 'Joined (1)' }) })
    .locator('..')
  await expect(joinedSection.getByText('Team Added Contest')).toBeVisible()
})
