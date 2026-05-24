import { expect, test } from '@playwright/test'

test('tournament manager create flow has generate button for JSON and Auction payloads', async ({
  page,
}) => {
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

  await page.route('**/admin/team-squads', async (route) => {
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
          matchesCount: 2,
          contestsCount: 1,
          enabled: true,
          source: 'manual',
          lastUpdatedAt: new Date().toISOString(),
        },
      ]),
    })
  })

  await page.route('**/tournaments/ipl-2026-custom/matches', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: '65',
          name: 'Match 65: KKR vs MI',
          startAt: '2026-05-20T14:00:00.000Z',
          status: 'completed',
        },
      ]),
    })
  })

  await page.route('**/admin/tournaments/ipl-2026-custom/matches/import', async (route) => {
    const payload = route.request().postDataJSON()
    expect(payload.updateExistingContests).toBe(true)
    expect(payload.matches).toHaveLength(1)
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        matchesImported: 1,
        contestsUpdated: 1,
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

  await page.getByRole('button', { name: '+ Add matches' }).click()
  await page.getByRole('button', { name: 'Generate JSON' }).click()
  const matchesDialog = page.getByRole('dialog', { name: 'Generated Matches JSON' })
  await expect(matchesDialog).toBeVisible()
  await expect(matchesDialog.locator('.score-preview-textarea').first()).toContainText(
    '"matches"',
  )
  await expect(matchesDialog.locator('.score-preview-textarea-prompt')).toContainText(
    '/admin/tournaments/:id/matches/import',
  )
  await matchesDialog.getByRole('button', { name: 'Use Template' }).click()
  await page.getByRole('button', { name: 'Add matches', exact: true }).click()
  await expect(page.getByText('Added 1 matches; updated 1 contests')).toBeVisible()

  await page.getByRole('tab', { name: 'Create' }).click()

  const sectionHead = page.locator('.create-tournament-card .contest-section-head')
  const tabs = page
    .locator('.create-tournament-card .create-tournament-input-tabs')
    .first()
  await expect(sectionHead).toBeVisible()
  await expect(tabs).toBeVisible()
  const [headBox, tabsBox] = await Promise.all([
    sectionHead.boundingBox(),
    tabs.boundingBox(),
  ])
  expect(headBox).toBeTruthy()
  expect(tabsBox).toBeTruthy()
  if (headBox && tabsBox) {
    // Top controls should be tightly packed with small vertical separation.
    expect(tabsBox.y - (headBox.y + headBox.height)).toBeLessThan(24)
  }

  await page.getByRole('tab', { name: 'JSON' }).click()
  await page.getByRole('button', { name: 'Generate JSON' }).click()
  const tournamentDialog = page.getByRole('dialog', { name: 'Generated Tournament JSON' })
  await expect(tournamentDialog).toBeVisible()
  await expect(tournamentDialog.locator('.score-preview-textarea').first()).toContainText(
    '"name": "IPL 2026"',
  )
  await expect(tournamentDialog.getByText('AI Prompt For Tournament JSON')).toBeVisible()
  await expect(
    tournamentDialog.getByRole('button', { name: 'Copy AI Prompt' }),
  ).toBeVisible()
  await expect(tournamentDialog.locator('.score-preview-textarea-prompt')).toContainText(
    '/admin/tournaments',
  )
  await tournamentDialog.getByRole('button', { name: 'Close' }).click()
  await expect(tournamentDialog).toBeHidden()

  await page.getByRole('tab', { name: 'Auction' }).click()
  await page.getByRole('button', { name: 'Generate JSON' }).click()
  const auctionDialog = page.getByRole('dialog', { name: 'Generated Auction JSON' })
  await expect(auctionDialog).toBeVisible()
  await expect(auctionDialog.locator('.score-preview-textarea').first()).toContainText(
    '"contestName"',
  )
  await expect(auctionDialog.getByText('AI Prompt For Auction JSON')).toBeVisible()
  await expect(
    auctionDialog.getByRole('button', { name: 'Copy AI Prompt' }),
  ).toBeVisible()
  await expect(auctionDialog.locator('.score-preview-textarea-prompt')).toContainText(
    '/admin/auctions/import',
  )
  await auctionDialog.getByRole('button', { name: 'Close' }).click()
  await expect(auctionDialog).toBeHidden()
})
