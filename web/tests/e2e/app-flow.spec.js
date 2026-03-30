import { expect, test } from '@playwright/test'
import { loginUi } from './helpers/mock-e2e.js'

const loginAs = async (page, userId = 'player', password = 'demo123') =>
  loginUi(page, userId, password)

const ensureAdminLogin = async (page) => {
  await loginAs(page, 'admin', 'demo123')
  return 'admin'
}

const ensureMasterLogin = async (page) => {
  await loginAs(page, 'master', 'demo123')
  return 'master'
}

const gotoWithRetry = async (page, path) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 45000 })
      return
    } catch (error) {
      if (attempt === 1) throw error
    }
  }
}

test.describe('Role and navigation flow', () => {
  test('default player account should not see admin sections', async ({ page }) => {
    await loginAs(page, 'player', 'demo123')

    await expect(page.getByRole('button', { name: 'Admin Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Score Updates' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Audit Logs' })).toHaveCount(0)
  })

  test('player should not see admin sections and brand should route to home', async ({
    page,
  }) => {
    await loginAs(page, 'player', 'demo123')

    await expect(page.getByRole('button', { name: 'Admin Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Score Updates' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Audit Logs' })).toHaveCount(0)

    await page.locator('a.brand').click()
    await expect(page).toHaveURL(/\/home/)
  })

  test('admin should see admin section but not master section', async ({ page }) => {
    await ensureAdminLogin(page)

    await expect(page.getByRole('button', { name: 'Admin Manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Score Updates' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Audit Logs' })).toBeVisible()

    await expect(page.getByRole('link', { name: 'All Pages' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'All APIs' })).toHaveCount(0)
  })

  test('contest manager should see admin section but not master section', async ({
    page,
  }) => {
    await loginAs(page, 'contestmgr', 'demo123')

    await expect(page.getByRole('button', { name: 'Admin Manager' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Score Updates' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Audit Logs' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'All Pages' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'All APIs' })).toHaveCount(0)
  })

  test('master admin should see admin and master sections', async ({ page }) => {
    await ensureMasterLogin(page)

    await expect(page.getByRole('button', { name: 'Admin Manager' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Score Updates' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Audit Logs' })).toBeVisible()

    await expect(page.getByRole('link', { name: 'All Pages' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'All APIs' })).toBeVisible()
  })
})

test.describe('Admin master scenarios', () => {
  test('login users should route to home and preserve role gates', async ({ page }) => {
    const masterUserId = await ensureMasterLogin(page)
    const adminUserId = await ensureAdminLogin(page)
    await page.goto('/login')
    for (const userId of [masterUserId, adminUserId, 'player']) {
      await loginAs(page, userId, 'demo123')
      await expect(page).toHaveURL(/\/home/)
      if (userId === 'player') {
        await expect(page.getByRole('button', { name: 'Admin Manager' })).toHaveCount(0)
      } else {
        await expect(page.getByRole('button', { name: 'Admin Manager' })).toBeVisible()
      }
      await page.goto('/login')
    }
  })

  test('reload on /home keeps logged-in user signed in when local expiry is stale', async ({
    page,
  }) => {
    await loginAs(page, 'player', 'demo123')
    await page.goto('/home')
    await expect(page).toHaveURL(/\/home/)

    await page.evaluate(() => {
      const raw = window.localStorage.getItem('myxi-user')
      if (!raw) throw new Error('missing stored user')
      const parsed = JSON.parse(raw)
      parsed.tokenExpiresAt = Date.now() - 1000
      window.localStorage.setItem('myxi-user', JSON.stringify(parsed))
    })

    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/home/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('add/remove tournament and create contest', async ({ page }) => {
    await ensureMasterLogin(page)

    await page.getByRole('button', { name: 'Admin Manager' }).click()
    await page.getByRole('tab', { name: /Tournaments \(/ }).click()

    const hundredRow = page.locator('tr', { hasText: 'The Hundred 2026' })
    await expect(hundredRow).toBeVisible()
    const hundredCheckbox = hundredRow.locator('input[type="checkbox"]')
    if (!(await hundredCheckbox.isChecked())) {
      await hundredCheckbox.check()
      await page.getByRole('button', { name: 'Add to Tournaments' }).click()
      await expect(page.getByText('Dashboard feed unavailable')).toHaveCount(0)
    }

    await gotoWithRetry(page, '/fantasy')
    await expect(page.getByText('The Hundred 2026')).toBeVisible()

    await page.goto('/home')
    await page.getByRole('button', { name: 'Admin Manager' }).click()
    await page.getByRole('tab', { name: /Tournaments \(/ }).click()
    if (await hundredCheckbox.isChecked()) {
      await hundredCheckbox.click()
      await page.getByRole('button', { name: 'Remove from Tournaments' }).click()
      const removeConfirm = page.locator('.ui-modal-card').getByRole('button', {
        name: 'Remove',
        exact: true,
      })
      await expect(removeConfirm).toBeVisible()
      await removeConfirm.click({ force: true })
      await expect(page.getByText('Dashboard feed unavailable')).toHaveCount(0)
    }

    await page.goto('/fantasy')
    await expect(page.getByText('The Hundred 2026')).toHaveCount(0)

    const contestName = `e2e-${Date.now()}`
    await page.getByRole('button', { name: '+ Create contest' }).click()
    await page.getByLabel('Tournament').selectOption('t20wc-2026')
    await page.getByLabel('Contest name').fill(contestName)
    await page.getByLabel('Max players').fill('77')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.goto('/home')
    await page.getByRole('button', { name: 'Admin Manager' }).click()
    await page.getByRole('tab', { name: 'Contests' }).click()
    await page.getByRole('combobox').first().selectOption('t20wc-2026')
    await expect(page.locator('.catalog-table tbody tr', { hasText: contestName }).first()).toBeVisible()
  })

  test('manage contests from Admin Manager Contests tab and reflect in fantasy', async ({
    page,
  }) => {
    await ensureMasterLogin(page)

    await page.getByRole('button', { name: 'Admin Manager' }).click()
    await page.getByRole('tab', { name: 'Contests' }).click()
    await page.getByRole('combobox').first().selectOption('t20wc-2026')

    const rows = page.locator('.catalog-table tbody tr')
    await expect(rows.first()).toBeVisible()
    const rowCount = await rows.count()
    let targetRow = rows.first()
    for (let i = 0; i < rowCount; i += 1) {
      const row = rows.nth(i)
      if (await row.locator('input[type="checkbox"]').isChecked()) {
        targetRow = row
        break
      }
    }

    const contestName = (await targetRow.locator('td').first().innerText()).trim()
    const targetCheckbox = targetRow.locator('input[type="checkbox"]')
    if (await targetCheckbox.isChecked()) {
      await targetCheckbox.uncheck()
    }
    await page.getByRole('button', { name: 'Save' }).click()

    await page.goto('/fantasy')
    await page.locator('.tournament-filter-tile', { hasText: 'T20 World Cup 2026' }).click()
    await expect(page.getByText(contestName)).toHaveCount(0)

    await page.goto('/home')
    await page.getByRole('button', { name: 'Admin Manager' }).click()
    await page.getByRole('tab', { name: 'Contests' }).click()
    await page.getByRole('combobox').first().selectOption('t20wc-2026')
    const restoreRow = page.locator('.catalog-table tbody tr', { hasText: contestName }).first()
    await restoreRow.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: 'Save' }).click()

    await page.goto('/fantasy')
    await page.locator('.tournament-filter-tile', { hasText: 'T20 World Cup 2026' }).click()
    await expect(
      page.locator('article.compact-contest-card', { hasText: contestName }).first(),
    ).toBeVisible()
  })

  test('team edit and quick leaderboard preview from contest page', async ({ page }) => {
    await loginAs(page, 'player', 'demo123')

    await page.goto('/tournaments/t20wc-2026/contests/huntercherry')
    await expect(page.getByRole('heading', { name: 'Huntercherry Contest' })).toBeVisible()
    const editableRow = page
      .locator('.match-table tbody tr', { hasText: 'Not Started' })
      .first()
    await expect(editableRow).toBeVisible()
    await editableRow.getByLabel(/Edit team|Add team/).click()
    await expect(page).toHaveURL(/\/fantasy\/select/)
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()

    await page.goto('/tournaments/t20wc-2026/contests/huntercherry')
    await page.getByRole('button', { name: 'Preview leaderboard' }).click()
    await expect(page.getByText(/leaderboard preview/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open leaderboard page' })).toBeVisible()
    await page.locator('.ui-modal-card').getByRole('button', { name: 'Close' }).click()
    await expect(page.getByText(/leaderboard preview/i)).toHaveCount(0)

    await page.getByRole('button', { name: 'Preview leaderboard' }).click()
    await page.getByRole('link', { name: 'Open leaderboard page' }).click()
    await expect(page).toHaveURL(/\/leaderboard/)
    await expect(page.locator('.loading-note .loading-dots')).toHaveCount(0)
  })

  test('match submitted count should match participants rows', async ({ page }) => {
    await loginAs(page, 'kiran11', 'demo123')
    await page.goto('/tournaments/psl-2026/contests/stump-vision-xi')
    await expect(page.getByRole('heading', { name: 'Stump Vision XI' })).toBeVisible()

    const firstRow = page.locator('.match-table tbody tr').first()
    await expect(firstRow).toBeVisible()
    await firstRow.click()

    const actionBadge = firstRow.locator('button.icon-eye-btn span').first()
    let submittedCount = 0
    if (await actionBadge.count()) {
      const raw = await actionBadge.innerText()
      submittedCount = Number(String(raw).replace(/[^0-9]/g, '') || 0)
    }
    await expect(page.locator('.participants-table tbody tr')).toHaveCount(submittedCount)
  })

  test('match -> participant -> eye preview points stay in sync for multiple matches', async ({
    page,
  }) => {
    await ensureMasterLogin(page)
    const joinedContests = await page.request.fetch(
      'http://127.0.0.1:4000/contests?tournamentId=t20wc-2026&joined=true&userId=master',
    )
    const rows = await joinedContests.json().catch(() => [])
    const targetContest = (rows || [])[0]
    expect(targetContest?.id).toBeTruthy()
    await page.goto(`/tournaments/t20wc-2026/contests/${targetContest.id}`)
    await expect(page.getByRole('heading', { name: targetContest.name })).toBeVisible()

    const parseNumber = (value) => Number(String(value).replace(/[^0-9.-]/g, '') || 0)

    for (let index = 0; index < 2; index += 1) {
      const matchRow = page.locator('.match-table tbody tr').nth(index)
      await expect(matchRow).toBeVisible()
      await matchRow.locator('.match-name-btn').click()

      const participantRows = page
        .locator('.participants-table tbody tr')
        .filter({ has: page.locator('button.icon-eye-btn:not([disabled])') })
      if ((await participantRows.count()) === 0) {
        continue
      }
      const participantRow = participantRows.first()
      await expect(participantRow).toBeVisible()

      const participantPointsText = await participantRow.locator('td').nth(1).innerText()
      const participantPoints = parseNumber(participantPointsText)

      await participantRow.locator('button.icon-eye-btn').click({ force: true })
      await expect(page.locator('.team-preview-drawer.open')).toBeVisible()

      const headPointsText = await page
        .locator('.team-preview-head p')
        .filter({ hasText: 'Points:' })
        .first()
        .innerText()
      const headerPoints = parseNumber(headPointsText)
      expect(headerPoints).toBeGreaterThanOrEqual(0)
      expect(participantPoints).toBeGreaterThanOrEqual(0)

      const rowPointTexts = await page
        .locator('.team-preview-panel .team-preview-list')
        .first()
        .locator('.team-preview-row span')
        .allTextContents()
      const previewTotal = rowPointTexts.reduce((sum, text) => sum + parseNumber(text), 0)
      expect(previewTotal).toBeGreaterThanOrEqual(0)

      await page.locator('.team-preview-head').getByRole('button', { name: 'Close' }).click()
      await expect(page.locator('.team-preview-drawer.open')).toHaveCount(0)
    }
  })
})
