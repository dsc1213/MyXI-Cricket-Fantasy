import { expect, test } from '@playwright/test'
import { loginUi } from './helpers/mock-e2e.js'

const roleRank = (roleText = '') => {
  const role = roleText.toString().trim().toUpperCase()
  if (role.includes('BAT')) return 0
  if (role.includes('WICKET') || role === 'WK') return 1
  if (role.includes('ALL') || role === 'AR') return 2
  if (role.includes('BOWL')) return 3
  return 99
}

test('team selection keeps role ordering and uses single-column player tiles on mobile', async ({
  page,
}) => {
  await loginUi(page, 'player', 'demo123')
  await page.goto('/tournaments/t20wc-2026/contests/huntercherry')

  const rows = page.locator('.match-table tbody tr')
  await expect(rows.first()).toBeVisible()

  const rowCount = await rows.count()
  let targetAction = rows
    .first()
    .getByLabel(/Edit team|Add team/i)
    .first()
  for (let index = 0; index < rowCount; index += 1) {
    const action = rows
      .nth(index)
      .getByLabel(/Edit team|Add team/i)
      .first()
    if ((await action.count()) > 0) {
      targetAction = action
      break
    }
  }

  await targetAction.click()
  await expect(page).toHaveURL(/\/fantasy\/select/)
  await expect(page.locator('.team-column .player-tile').first()).toBeVisible()
  await expect(page.locator('.myxi-role-lane-title')).toHaveCount(0)
  await expect(page.locator('.myxi-card .myxi-role-lane')).toHaveCount(4)

  const desktopLaneColumns = await page
    .locator('.myxi-card .myxi-role-lane:not(.is-empty) .myxi-role-lane-chips')
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const tracks = getComputedStyle(node).gridTemplateColumns
        return tracks
          .split(' ')
          .map((item) => item.trim())
          .filter(Boolean).length
      }),
    )
  expect(desktopLaneColumns.length).toBeGreaterThan(0)
  desktopLaneColumns.forEach((count) => expect(count).toBe(2))

  const teamColumns = page.locator('.team-column')
  const columnCount = await teamColumns.count()
  expect(columnCount).toBeGreaterThanOrEqual(2)

  for (let columnIndex = 0; columnIndex < Math.min(columnCount, 2); columnIndex += 1) {
    const roles = await teamColumns
      .nth(columnIndex)
      .locator('.player-identity-subtitle')
      .allInnerTexts()
    const ranks = roles.map((entry) => roleRank(entry))
    for (let idx = 1; idx < ranks.length; idx += 1) {
      expect(ranks[idx]).toBeGreaterThanOrEqual(ranks[idx - 1])
    }
  }

  const selectUrl = page.url()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(selectUrl)
  await expect(page.locator('.team-column .tile-grid.two-col').first()).toBeVisible()
  await expect(page.locator('.team-bar-actions .desktop-save')).toBeHidden()
  await page.getByRole('button', { name: /preview/i }).click()
  await expect(page.getByRole('button', { name: /save team/i })).toBeVisible()
  await expect(page.locator('.ui-modal-card .myxi-role-lane-title')).toHaveCount(0)
  await expect(page.locator('.ui-modal-card .myxi-role-lane')).toHaveCount(4)

  const mobileLaneColumns = await page
    .locator('.ui-modal-card .myxi-role-lane:not(.is-empty) .myxi-role-lane-chips')
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const tracks = getComputedStyle(node).gridTemplateColumns
        return tracks
          .split(' ')
          .map((item) => item.trim())
          .filter(Boolean).length
      }),
    )
  expect(mobileLaneColumns.length).toBeGreaterThan(0)
  mobileLaneColumns.forEach((count) => expect(count).toBe(2))

  const mobileColumnCount = await page
    .locator('.team-column .tile-grid.two-col')
    .first()
    .evaluate((node) => {
      const tracks = getComputedStyle(node).gridTemplateColumns
      return tracks
        .split(' ')
        .map((item) => item.trim())
        .filter(Boolean).length
    })

  expect(mobileColumnCount).toBe(1)
})
