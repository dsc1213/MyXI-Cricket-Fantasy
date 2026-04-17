import { expect, test } from '@playwright/test'

test('team preview shows effective XI ownership counts and expanded participant roles', async ({
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
          id: 'm-1',
          matchNo: 1,
          home: 'MI',
          away: 'PBKS',
          name: 'MI vs PBKS',
          startAt: '2026-04-16T14:00:00.000Z',
          status: 'Completed',
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
        participants: [
          {
            id: 'u-2',
            userId: 'hunter',
            gameName: 'HunterCherryXI',
            name: 'HunterCherryXI',
            points: 84,
          },
        ],
        joinedCount: 3,
        previewXI: [],
        previewBackups: [],
      }),
    })
  })

  await page.route('**/users/hunter/picks?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: 'hunter',
        tournamentId: 't-1',
        contestId: 'c-1',
        matchId: 'm-1',
        picksDetailed: [
          {
            id: 11,
            name: 'Rohit Sharma',
            role: 'BAT',
            team: 'MI',
            imageUrl: '',
            points: 42,
            basePoints: 21,
            multiplier: 2,
            roleTag: 'C',
            ownership: {
              pickedByCount: 3,
              captainCount: 1,
              viceCaptainCount: 1,
              pickedBy: [
                { userId: 'hunter', name: 'HunterCherryXI', roleTag: 'C' },
                { userId: 'abc11', name: 'abc11', roleTag: 'VC' },
                { userId: 'test7', name: 'test7', roleTag: '' },
              ],
            },
            pointBreakdown: [],
          },
        ],
        backupsDetailed: [
          {
            id: 22,
            name: 'Tilak Varma',
            role: 'BAT',
            team: 'MI',
            imageUrl: '',
            points: 0,
            basePoints: 0,
            multiplier: 1,
            roleTag: '',
            pointBreakdown: [],
          },
        ],
      }),
    })
  })

  await page.goto('/tournaments/t-1/contests/c-1', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: /View HunterCherryXI team/ }).click()

  await expect(page.getByText('Rohit Sharma')).toBeVisible()
  const ownershipButton = page.getByRole('button', {
    name: /Show ownership for Rohit Sharma/,
  })
  await expect(ownershipButton).toBeVisible()
  await expect(ownershipButton).toContainText('3')

  await ownershipButton.click()
  const ownershipPanel = page.locator('.team-preview-ownership-panel')
  await expect(ownershipPanel.getByText('HunterCherryXI')).toBeVisible()
  await expect(ownershipPanel.getByText('abc11')).toBeVisible()
  await expect(ownershipPanel.getByText('test7')).toBeVisible()
})

test('team preview stays unavailable before the match starts', async ({ page }) => {
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
          id: 'm-1',
          matchNo: 1,
          home: 'MI',
          away: 'PBKS',
          name: 'MI vs PBKS',
          startAt: '2026-04-16T14:00:00.000Z',
          status: 'Not Started',
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
        participants: [
          {
            id: 'u-2',
            userId: 'hunter',
            gameName: 'HunterCherryXI',
            name: 'HunterCherryXI',
            points: 84,
          },
        ],
        joinedCount: 3,
        previewXI: [],
        previewBackups: [],
      }),
    })
  })

  await page.route('**/users/hunter/picks?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        userId: 'hunter',
        tournamentId: 't-1',
        contestId: 'c-1',
        matchId: 'm-1',
        picksDetailed: [
          {
            id: 11,
            name: 'Rohit Sharma',
            role: 'BAT',
            team: 'MI',
            imageUrl: '',
            points: 42,
            basePoints: 21,
            multiplier: 2,
            roleTag: 'C',
            ownership: {
              pickedByCount: 3,
              captainCount: 1,
              viceCaptainCount: 1,
              pickedBy: [
                { userId: 'hunter', name: 'HunterCherryXI', roleTag: 'C' },
                { userId: 'abc11', name: 'abc11', roleTag: 'VC' },
                { userId: 'test7', name: 'test7', roleTag: '' },
              ],
            },
            pointBreakdown: [],
          },
        ],
        backupsDetailed: [],
      }),
    })
  })

  await page.goto('/tournaments/t-1/contests/c-1', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('button', { name: /View HunterCherryXI team/ })).toBeDisabled()
  await expect(page.locator('.team-preview-drawer.open')).toHaveCount(0)
})
