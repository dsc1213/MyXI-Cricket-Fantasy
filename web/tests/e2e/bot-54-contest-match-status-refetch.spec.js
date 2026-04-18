import { expect, test } from '@playwright/test'

test('contest detail refetches match status instead of reusing stale contest match cache', async ({
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

  let allMatchesRequestCount = 0

  await page.route('**/contests/c-1/matches**', async (route) => {
    const url = new URL(route.request().url())
    const team = url.searchParams.get('team') || 'all'

    if (team === 'DC') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'm-dc',
            matchNo: 8,
            home: 'DC',
            away: 'LSG',
            name: 'DC vs LSG',
            startAt: '2026-04-20T14:00:00.000Z',
            status: 'Not Started',
            viewerJoined: false,
            hasTeam: false,
            submittedCount: 0,
          },
        ]),
      })
      return
    }

    allMatchesRequestCount += 1
    const status = allMatchesRequestCount === 1 ? 'In Progress' : 'Not Started'

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'm-srh',
          matchNo: 7,
          home: 'SRH',
          away: 'CSK',
          name: 'SRH vs CSK',
          startAt: '2026-04-18T14:00:00.000Z',
          status,
          viewerJoined: true,
          hasTeam: true,
          submittedCount: 8,
        },
        {
          id: 'm-dc',
          matchNo: 8,
          home: 'DC',
          away: 'LSG',
          name: 'DC vs LSG',
          startAt: '2026-04-20T14:00:00.000Z',
          status: 'Not Started',
          viewerJoined: false,
          hasTeam: false,
          submittedCount: 0,
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

  const srhRow = page.getByRole('row', { name: /SRH vs CSK/i })
  await expect(srhRow).toContainText('In Progress')
  await expect(srhRow.getByLabel('Edit team')).toHaveCount(0)

  await page.locator('.matches-card select').nth(1).selectOption('DC')
  await expect(page.getByRole('row', { name: /DC vs LSG/i })).toBeVisible()
  await expect(page.getByRole('row', { name: /SRH vs CSK/i })).toHaveCount(0)

  await page.locator('.matches-card select').nth(1).selectOption('all')

  await expect(srhRow).toContainText('Not Started')
  await expect(srhRow.getByLabel('Edit team')).toBeVisible()
})
