import { expect, test } from '@playwright/test'
import { loginUi } from './helpers/mock-e2e.js'

test('contest detail mobile match table is compact, unlocked, and scrolls only below min width', async ({
  page,
}) => {
  await loginUi(page, 'player', 'demo123')
  await page.setViewportSize({ width: 430, height: 932 })

  await page.goto('/tournaments/t20wc-2026/contests/huntercherry')
  await expect(page.locator('.match-table-wrap')).toBeVisible()

  const addTeamButtons = page.locator('.match-table button[aria-label="Add team"]')
  if ((await addTeamButtons.count()) > 0) {
    await expect(addTeamButtons.first()).toContainText('Join')
  }

  const standardWidthState = await page.locator('.match-table-wrap').evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }))

  const unlockedColumnState = await page.locator('.match-table-wrap').evaluate((node) => {
    const headerCell = node.querySelector('.match-table thead th:first-child')
    const firstCell = node.querySelector('.match-table tbody tr td:first-child')
    const secondCell = node.querySelector('.match-table tbody tr td:nth-child(2)')
    const dateCell = node.querySelector(
      '.match-table tbody tr td:nth-child(2) .match-date-cell',
    )
    const dateMain = node.querySelector(
      '.match-table tbody tr td:nth-child(2) .match-date-main',
    )
    const dateTime = node.querySelector(
      '.match-table tbody tr td:nth-child(2) .match-date-time',
    )
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
      dateDisplay: dateCell ? getComputedStyle(dateCell).display : '',
      dateMainExists: Boolean(dateMain),
      dateTimeExists: Boolean(dateTime),
    }

    return {
      hasCells: true,
      firstDrift: Math.abs(after.first - before.first),
      secondShift: before.second - after.second,
      ...after,
    }
  })

  expect(unlockedColumnState.hasCells).toBe(true)
  if (standardWidthState.scrollWidth > standardWidthState.clientWidth + 1) {
    expect(unlockedColumnState.scrollLeft).toBeGreaterThan(0)
    expect(unlockedColumnState.firstDrift).toBeGreaterThan(20)
    expect(unlockedColumnState.secondShift).toBeGreaterThan(20)
  } else {
    expect(standardWidthState.scrollWidth).toBeLessThanOrEqual(
      standardWidthState.clientWidth + 1,
    )
  }
  expect(unlockedColumnState.headerPosition).not.toBe('sticky')
  expect(unlockedColumnState.cellPosition).not.toBe('sticky')
  expect(unlockedColumnState.dateDisplay).toBe('grid')
  expect(unlockedColumnState.dateMainExists).toBe(true)
  expect(unlockedColumnState.dateTimeExists).toBe(true)

  await page.setViewportSize({ width: 320, height: 932 })
  const narrowScrollState = await page.locator('.match-table-wrap').evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }))
  expect(narrowScrollState.scrollWidth).toBeGreaterThan(narrowScrollState.clientWidth)

  const participantsWrap = page.locator('.participants-table-wrap')
  await expect(participantsWrap).toBeVisible()
  const participantsHasRows =
    (await page.locator('.participants-table tbody tr').count()) > 0
  if (participantsHasRows) {
    await page.setViewportSize({ width: 430, height: 932 })
    const participantsStandardState = await participantsWrap.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }))

    expect(participantsStandardState.scrollWidth).toBeLessThanOrEqual(
      participantsStandardState.clientWidth + 1,
    )

    await page.setViewportSize({ width: 320, height: 932 })
    const participantsNarrowState = await participantsWrap.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }))

    expect(participantsNarrowState.scrollWidth).toBeGreaterThan(
      participantsNarrowState.clientWidth,
    )
  }
})
