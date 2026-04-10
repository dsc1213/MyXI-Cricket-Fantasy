import { expect, test } from '@playwright/test'

test('shared app query cache reuses repeated GETs in-session and reload fetches fresh again', async ({
  page,
}) => {
  let matchRequestCount = 0

  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        id: 101,
        userId: 'cache-bot',
        gameName: 'cache-bot',
        name: 'Cache Bot',
        role: 'admin',
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
        tournaments: [{ id: 't-1', name: 'IPL 2026' }],
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

  await page.route('**/tournaments/t-1/matches', async (route) => {
    matchRequestCount += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'm-1', name: 'MI vs CSK' }]),
    })
  })

  await page.goto('/home', { waitUntil: 'domcontentloaded' })

  const firstRun = await page.evaluate(async () => {
    const api = await import('/src/lib/api.js')
    const first = await api.fetchTournamentMatches('t-1')
    const second = await api.fetchTournamentMatches('t-1')
    return { first, second }
  })

  expect(firstRun.first).toEqual([{ id: 'm-1', name: 'MI vs CSK' }])
  expect(firstRun.second).toEqual([{ id: 'm-1', name: 'MI vs CSK' }])
  expect(matchRequestCount).toBe(1)

  await page.reload({ waitUntil: 'domcontentloaded' })

  const secondRun = await page.evaluate(async () => {
    const api = await import('/src/lib/api.js')
    return api.fetchTournamentMatches('t-1')
  })

  expect(secondRun).toEqual([{ id: 'm-1', name: 'MI vs CSK' }])
  expect(matchRequestCount).toBe(2)
})
