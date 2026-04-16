import { expect, test } from '@playwright/test'

test('contest detail defaults to today or in-progress match instead of first API row', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        id: 1,
        userId: 'player',
        gameName: 'player',
        name: 'Player',
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

  await page.route('**/contests/c-1', async (route) => {
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
        name: 'Mega Contest',
        status: 'Open',
      }),
    })
  })

  await page.route('**/contests/c-1/matches**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'm-old',
          matchNo: 1,
          home: 'SRH',
          away: 'RR',
          name: 'SRH vs RR',
          startAt: '2026-04-13T14:00:00.000Z',
          status: 'Completed',
          viewerJoined: true,
          hasTeam: true,
        },
        {
          id: 'm-today',
          matchNo: 4,
          home: 'MI',
          away: 'PBKS',
          name: 'MI vs PBKS',
          startAt: '2026-04-16T14:00:00.000Z',
          status: 'In Progress',
          viewerJoined: true,
          hasTeam: true,
        },
      ]),
    })
  })

  await page.route('**/contests/c-1/participants**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        participants: [],
        joinedCount: 0,
        previewXI: [],
        previewBackups: [],
      }),
    })
  })

  await page.goto('/tournaments/t-1/contests/c-1', { waitUntil: 'domcontentloaded' })

  const activeRow = page.locator('.match-table tbody tr.active')
  await expect(activeRow).toContainText('MI')
  await expect(activeRow).toContainText('PBKS')
  await expect(activeRow).not.toContainText('SRH')
})
