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

  await page.getByRole('tab', { name: 'Create' }).click()

  const sectionHead = page.locator('.create-tournament-card .contest-section-head')
  const tabs = page.locator('.create-tournament-card .create-tournament-input-tabs')
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
  await expect(tournamentDialog.locator('.score-preview-textarea')).toContainText(
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
  await expect(auctionDialog.locator('.score-preview-textarea')).toContainText(
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
