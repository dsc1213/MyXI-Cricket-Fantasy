import { expect, test } from '@playwright/test'

test('tournament manager uses search filter and hides selector row', async ({ page }) => {
  await page.route('**/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route('**/page-load-data', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tournaments: [],
        pointsRuleTemplate: {},
        adminManager: [],
        masterConsole: [],
        auditLogs: [],
      }),
    })
  })

  await page.route('**/contests**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/admin/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/admin/tournaments/catalog', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 't1',
          name: 'IPL 2026',
          season: '2026',
          matchesCount: 70,
          contestsCount: 2,
          enabled: true,
          lastUpdatedAt: new Date().toISOString(),
        },
        {
          id: 't2',
          name: 'DBG 1775436903793',
          season: '2026',
          matchesCount: 1,
          contestsCount: 1,
          enabled: false,
          lastUpdatedAt: new Date().toISOString(),
        },
      ]),
    })
  })

  await page.route('**/tournaments/*/matches', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        id: '1',
        userId: 'master',
        gameName: 'master',
        name: 'Master Admin',
        role: 'master_admin',
        token: 'e2e-token',
        tokenExpiresAt: now + 60 * 60 * 1000,
      }),
    )
    window.localStorage.setItem('myxi-token', 'e2e-token')
  })

  await page.goto('/home?panel=tournamentManager', { waitUntil: 'domcontentloaded' })

  const searchInput = page.getByRole('searchbox', { name: 'Search tournaments' })
  await expect(searchInput).toBeVisible()
  await expect(page.locator('.admin-manager-tournament-selector-row')).toHaveCount(0)

  await searchInput.fill('ipl')
  await expect(page.getByRole('cell', { name: 'IPL 2026' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'DBG 1775436903793' })).toHaveCount(0)
})
