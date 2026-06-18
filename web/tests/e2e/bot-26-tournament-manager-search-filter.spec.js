import { expect, test } from '@playwright/test'

test.use({ timezoneId: 'America/Chicago' })

test('tournament manager uses search filter and hides selector row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let matchStartTime = '2099-03-10T14:00:00.000Z'
  let matchStatus = 'inprogress'
  let providerMatchId = ''
  let teamEditLockOverride = ''
  let updateStartTimeRequest = null
  let backupReplacementRequests = 0

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
      body: JSON.stringify([
        {
          id: 'm1',
          name: 'RCB vs SRH',
          startTime: matchStartTime,
          status: matchStatus,
          teamEditLockOverride,
          liveSync: { providerMatchId },
        },
      ]),
    })
  })

  await page.route('**/admin/matches/m1/start-time', async (route) => {
    updateStartTimeRequest = route.request().postDataJSON()
    matchStartTime = new Date(updateStartTimeRequest.startTime).toISOString()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'm1',
        name: 'RCB vs SRH',
        startTime: matchStartTime,
        status: matchStatus,
        teamEditLockOverride,
        liveSync: { providerMatchId },
      }),
    })
  })

  await page.route('**/admin/matches/m1/status', async (route) => {
    const payload = route.request().postDataJSON()
    matchStatus = payload.status
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'm1',
        status: matchStatus,
      }),
    })
  })

  await page.route('**/admin/matches/m1/provider-match-id', async (route) => {
    const payload = route.request().postDataJSON()
    providerMatchId = payload.providerMatchId
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'm1',
        liveSync: { providerMatchId },
      }),
    })
  })

  await page.route('**/admin/matches/m1/edit-lock', async (route) => {
    const payload = route.request().postDataJSON()
    teamEditLockOverride = payload.override
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'm1',
        teamEditLockOverride,
      }),
    })
  })

  await page.route('**/admin/matches/m1/replace-backups', async (route) => {
    backupReplacementRequests += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        autoReplacement: { updatedSelections: 2, skippedSelections: 1 },
      }),
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
  await expect(page.locator('.tm-card-title', { hasText: 'IPL 2026' })).toBeVisible()
  await expect(
    page.locator('.tm-card', { hasText: 'DBG 1775436903793' }),
  ).toHaveCount(0)

  // Mobile master-detail: switch to the Matches tab to manage the selected tournament.
  await page.getByRole('tab', { name: /^Matches/ }).click()

  const startTimeInput = page.getByLabel('Match start time RCB vs SRH')
  await startTimeInput.fill('2099-03-11T16:30')
  await expect(page.getByText('Match start time updated')).toBeVisible()
  await expect(startTimeInput).toHaveValue('2099-03-11T16:30')
  expect(updateStartTimeRequest).toEqual({
    startTime: '2099-03-11T21:30:00.000Z',
  })

  const providerInput = page.getByLabel('Scraper match id RCB vs SRH')
  await providerInput.fill('123456')
  await providerInput.press('Tab')
  await expect(page.getByText('Scraper match id updated')).toBeVisible()
  await expect(providerInput).toHaveValue('123456')

  const statusSelect = page.getByLabel('Match status RCB vs SRH')
  await expect(statusSelect).toHaveValue('inprogress')
  await statusSelect.selectOption('notstarted')
  await expect(page.getByText('Match status updated')).toBeVisible()
  await expect(statusSelect).toHaveValue('notstarted')
  const matchCard = page.locator('.match-card', { hasText: 'RCB vs SRH' })
  await expect(
    matchCard.locator('.match-status-badge').filter({ hasText: /^Not Started$/ }),
  ).toBeVisible()

  const teamEditSelect = page.getByLabel('Team edit lock RCB vs SRH')
  await teamEditSelect.selectOption('force_open')
  await expect(page.getByText('Match edit lock updated')).toBeVisible()
  await expect(teamEditSelect).toHaveValue('force_open')

  await page.getByRole('button', { name: 'Replace Backups' }).click()
  await expect(page.getByText('Backups replaced (2 updated, 1 skipped)')).toBeVisible()
  expect(backupReplacementRequests).toBe(1)

  const panel = page.locator('.dashboard-panel-view')
  const matchesHeading = page.getByRole('heading', {
    name: 'Matches • IPL 2026',
  })
  await matchesHeading.scrollIntoViewIfNeeded()
  await expect(matchesHeading).toBeInViewport()

  const scrollMetrics = await panel.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
    }
  })
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)
  expect(scrollMetrics.scrollTop).toBeGreaterThan(0)
})
