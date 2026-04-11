import { expect, test } from '@playwright/test'

test('home joined panel renders joined contests from page-load-data payload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        id: 101,
        userId: 'bot-joined-user',
        gameName: 'bot-joined-user',
        name: 'Joined Bot',
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

  await page.route('**/page-load-data', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tournaments: [{ id: 't-ipl', name: 'IPL 2026' }],
        joinedContests: [
          {
            id: 'c-joined-1',
            tournamentId: 't-ipl',
            name: 'Joined From Page Load',
            game: 'Fantasy',
            status: 'Open',
            points: 0,
            rank: 0,
            joined: true,
            lastUpdatedAt: '2026-04-11T17:05:00.000Z',
            lastUpdatedBy: 'Boomerr',
            lastUpdatedContext: 'KKR vs RR score',
          },
        ],
        pointsRuleTemplate: {},
        adminManager: [],
        masterConsole: [],
        auditLogs: [],
      }),
    })
  })

  await page.route('**/contests**', async (route) => {
    const url = route.request().url()
    const isJoinedOnly = url.includes('joined=true')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        isJoinedOnly
          ? [
              {
                id: 'c-joined-1',
                tournamentId: 't-ipl',
                name: 'Joined From Page Load',
                game: 'Fantasy',
                status: 'Open',
                joined: true,
              },
              {
                id: 'c-auction-1',
                tournamentId: 't-ipl',
                name: 'Auction Joined Contest',
                game: 'Fantasy',
                mode: 'fixed_roster',
                status: 'In Progress',
                joined: false,
                points: 12,
                rank: 2,
              },
            ]
          : [
              {
                id: 'c-joined-1',
                tournamentId: 't-ipl',
                name: 'Joined From Page Load',
                game: 'Fantasy',
                status: 'Open',
                joined: false,
              },
              {
                id: 'c-other-2',
                tournamentId: 't-ipl',
                name: 'Other Contest',
                game: 'Fantasy',
                status: 'Open',
                joined: false,
              },
            ],
      ),
    })
  })

  await page.goto('/home?panel=joined', { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: 'My Fantasy Contests' })).toBeVisible()
  await expect(page.getByText('Joined From Page Load')).toBeVisible()
  await expect(
    page.locator('.contest-tournament-pill', { hasText: 'IPL 2026' }),
  ).toBeVisible()
  await expect(page.getByText('Participants 0')).toBeVisible()
  await expect(page.getByText('Last Updated at: 04/11, 05:05 PM')).toBeVisible()
  await expect(page.getByText('Last Updated by: Boomerr (KKR vs RR score)')).toBeVisible()
  await expect(page.getByText('Points 0')).toBeVisible()
  await expect(page.getByText('Rank #0')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Leaderboard' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Leaderboard' })).toHaveAttribute(
    'href',
    '/tournaments/t-ipl/contests/c-joined-1/leaderboard',
  )
  await expect(page.getByRole('heading', { name: 'Auction Contests' })).toBeVisible()
  await expect(page.getByText('Auction Joined Contest')).toBeVisible()
  await expect(page.getByText('Points 12')).toBeVisible()
  await expect(page.getByText('Rank #2')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Leaderboard' }).nth(1)).toHaveAttribute(
    'href',
    '/tournaments/t-ipl/contests/c-auction-1/leaderboard?view=auction',
  )

  const tileHeight = await page
    .locator('.compact-contest-card')
    .first()
    .evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return rect.height
    })
  expect(tileHeight).toBeLessThan(280)

  const tileMetrics = await page
    .locator('.compact-contest-card')
    .first()
    .evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      overflowY: window.getComputedStyle(el).overflowY,
    }))
  expect(['visible', 'hidden']).toContain(tileMetrics.overflowY)
  expect(tileMetrics.scrollHeight).toBeGreaterThanOrEqual(tileMetrics.clientHeight)

  await expect(
    page.getByRole('heading', { name: 'No joined contests to show' }),
  ).toHaveCount(0)
})

test('dashboard panel view keeps full-height scrollable area', async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        id: 101,
        userId: 'bot-joined-user',
        gameName: 'bot-joined-user',
        name: 'Joined Bot',
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

  await page.route('**/page-load-data', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tournaments: [{ id: 't-ipl', name: 'IPL 2026' }],
        joinedContests: [],
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

  await page.goto('/home?panel=joined', { waitUntil: 'domcontentloaded' })

  const metrics = await page.locator('.dashboard-panel-view').evaluate((el) => {
    const shell = el.closest('.dashboard-shell')
    const style = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    const shellRect = shell ? shell.getBoundingClientRect() : null
    return {
      overflowY: style.overflowY,
      clientHeight: el.clientHeight,
      rectHeight: rect.height,
      viewportHeight: window.innerHeight,
      shellHeight: shellRect?.height || 0,
    }
  })

  expect(['auto', 'scroll']).toContain(metrics.overflowY)
  expect(metrics.clientHeight).toBeGreaterThan(120)
  expect(metrics.shellHeight).toBeGreaterThan(metrics.viewportHeight * 0.45)
  expect(metrics.rectHeight).toBeGreaterThan(metrics.shellHeight * 0.5)
})
