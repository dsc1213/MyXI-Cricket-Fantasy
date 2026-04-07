import { expect, test } from '@playwright/test'
import { loginUi } from './helpers/mock-e2e.js'

test('contest detail tables scroll horizontally on mobile without column compression', async ({
  page,
}) => {
  await loginUi(page, 'player', 'demo123')
  await page.setViewportSize({ width: 430, height: 932 })

  await page.goto('/tournaments/t20wc-2026/contests/huntercherry')
  await expect(page.locator('.match-table-wrap')).toBeVisible()

  const matchScrollState = await page.locator('.match-table-wrap').evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }))

  expect(matchScrollState.scrollWidth).toBeGreaterThan(matchScrollState.clientWidth)

  const lockedColumnState = await page.locator('.match-table-wrap').evaluate((node) => {
    const headerCell = node.querySelector('.match-table thead th:first-child')
    const firstCell = node.querySelector('.match-table tbody tr td:first-child')
    const secondCell = node.querySelector('.match-table tbody tr td:nth-child(2)')
    if (!headerCell || !firstCell || !secondCell) {
      return { hasCells: false }
    }

    const before = {
      first: firstCell.getBoundingClientRect().left,
      second: secondCell.getBoundingClientRect().left,
    }

    node.scrollLeft = 180

    const after = {
      first: firstCell.getBoundingClientRect().left,
      second: secondCell.getBoundingClientRect().left,
      scrollLeft: node.scrollLeft,
      headerPosition: getComputedStyle(headerCell).position,
      cellPosition: getComputedStyle(firstCell).position,
      headerLeft: getComputedStyle(headerCell).left,
      cellLeft: getComputedStyle(firstCell).left,
    }

    return {
      hasCells: true,
      firstDrift: Math.abs(after.first - before.first),
      secondShift: before.second - after.second,
      ...after,
    }
  })

  expect(lockedColumnState.hasCells).toBe(true)
  expect(lockedColumnState.scrollLeft).toBeGreaterThan(0)
  expect(lockedColumnState.firstDrift).toBeLessThanOrEqual(2)
  expect(lockedColumnState.secondShift).toBeGreaterThan(40)
  expect(lockedColumnState.headerPosition).toBe('sticky')
  expect(lockedColumnState.cellPosition).toBe('sticky')
  expect(lockedColumnState.headerLeft).toBe('0px')
  expect(lockedColumnState.cellLeft).toBe('0px')

  const participantsWrap = page.locator('.participants-table-wrap')
  await expect(participantsWrap).toBeVisible()
  const participantsHasRows =
    (await page.locator('.participants-table tbody tr').count()) > 0
  if (participantsHasRows) {
    const participantsScrollState = await participantsWrap.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }))
    expect(participantsScrollState.scrollWidth).toBeGreaterThan(
      participantsScrollState.clientWidth,
    )
  }
})
