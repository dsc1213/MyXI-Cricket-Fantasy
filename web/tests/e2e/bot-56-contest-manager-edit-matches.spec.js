import { expect, test } from '@playwright/test'

test('contest manager edit modal updates matches for one contest', async ({ page }) => {
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
          id: 'ipl-2026-custom',
          name: 'IPL 2026',
          season: '2026',
          matchesCount: 3,
          contestsCount: 1,
          enabled: true,
          source: 'manual',
          lastUpdatedAt: new Date().toISOString(),
        },
      ]),
    })
  })

  await page.route('**/admin/contests/catalog**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'c1',
          tournamentId: 'ipl-2026-custom',
          name: 'Office League',
          matchIds: ['m1'],
          game: 'Fantasy',
          mode: 'standard',
          status: 'Open',
          enabled: true,
          canStart: true,
          maxParticipants: 8,
          participantsCount: 0,
        },
      ]),
    })
  })

  await page.route('**/admin/contest-match-options**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'm1',
          name: 'Match 1: RCB vs CSK',
          startAt: '2026-05-25T14:00:00.000Z',
          status: 'notstarted',
        },
        {
          id: 'm2',
          name: 'Match 2: MI vs KKR',
          startAt: '2026-05-26T14:00:00.000Z',
          status: 'notstarted',
        },
      ]),
    })
  })

  await page.route('**/admin/contests/c1/participants', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ participants: [] }),
    })
  })

  await page.route('**/admin/contests/c1', async (route) => {
    expect(route.request().method()).toBe('PATCH')
    const payload = route.request().postDataJSON()
    expect(payload.matchIds).toEqual(['m1', 'm2'])
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, id: 'c1', matchIds: ['m1', 'm2'] }),
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

  await page.goto('/home?panel=contestManager', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: 'Edit' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit contest • Office League' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Selected 1 / 2')).toBeVisible()

  await dialog
    .getByRole('group', { name: 'Edit contest matches' })
    .getByText('Match 2: MI vs KKR')
    .click()
  await expect(dialog.getByText('Selected 2 / 2')).toBeVisible()

  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Contest updated')).toBeVisible()
})
