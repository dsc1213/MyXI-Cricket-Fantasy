import { expect, test } from '@playwright/test'
import {
  apiCall,
  createContest,
  deleteContestIfPresent,
  loginUi,
} from './helpers/mock-e2e.js'

const E2E_API_BASE = process.env.PW_E2E_API_BASE_URL || 'http://127.0.0.1:4000'

const createTournamentViaApi = async ({ request, tournamentId, name }) =>
  apiCall(
    request,
    'POST',
    '/admin/tournaments',
    {
      actorUserId: 'master',
      tournamentId,
      name,
      season: '2026',
      source: 'json',
      matches: [
        {
          id: 'm1',
          matchNo: 1,
          home: 'LQ',
          away: 'IU',
          date: '2099-03-10',
          startAt: '2099-03-10T14:00:00.000Z',
          venue: 'Karachi',
        },
      ],
    },
    201,
  )

test('score manager uses available width and keeps team grids vertically scrollable', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)

  const tag = Date.now()
  const tournamentId = `score-grid-fit-tour-${tag}`
  let contestId = ''

  try {
    await createTournamentViaApi({
      request,
      tournamentId,
      name: `Score Grid Fit Tournament ${tag}`,
    })

    const contest = await createContest({
      request,
      tournamentId,
      name: `Score Grid Fit Contest ${tag}`,
      matchIds: ['m1'],
    })
    contestId = contest.id

    await page.setViewportSize({ width: 1366, height: 768 })
    await loginUi(page, 'master')
    await page.goto('/home?panel=upload', { waitUntil: 'domcontentloaded' })

    const scopeRow = page.locator('.manual-scope-row')
    await scopeRow.getByLabel('Tournament').selectOption(tournamentId)
    await scopeRow.getByLabel('Match').selectOption('m1')
    await expect(page.getByText('Loading playing XI...')).toHaveCount(0)

    const assertLayout = async () => {
      const grid = page.locator('.manual-entry-grid').first()
      await expect(grid).toBeVisible()

      const widthMetrics = await page.evaluate(() => {
        const panel = document.querySelector('.match-scores-panel')
        const gridNode = document.querySelector('.manual-entry-grid')
        if (!panel || !gridNode) return { panelWidth: 0, gridWidth: 0, ratio: 0 }
        const panelWidth = panel.getBoundingClientRect().width
        const gridWidth = gridNode.getBoundingClientRect().width
        const ratio = panelWidth > 0 ? gridWidth / panelWidth : 0
        return { panelWidth, gridWidth, ratio }
      })

      expect(widthMetrics.panelWidth).toBeGreaterThan(600)
      expect(widthMetrics.ratio).toBeGreaterThan(0.9)

      const wraps = page.locator('.manual-team-table-wrap')
      await expect(wraps).toHaveCount(2)

      const wrapMetrics = await wraps.first().evaluate((node) => ({
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        overflowY: window.getComputedStyle(node).overflowY,
      }))

      expect(['auto', 'scroll']).toContain(wrapMetrics.overflowY)
      expect(wrapMetrics.scrollHeight).toBeGreaterThan(wrapMetrics.clientHeight)

      await wraps.first().evaluate((node) => {
        node.scrollTop = node.scrollHeight
      })

      const lastRow = wraps.first().locator('tbody tr').last()
      await expect(lastRow).toBeVisible()
    }

    // Playing XI manual entry
    await expect(page.getByRole('tab', { name: 'Playing XI' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const forceBackupsBtn = page.getByRole('button', { name: 'Force Backups' })
    await expect(forceBackupsBtn).toBeVisible()
    await expect(forceBackupsBtn).toHaveClass(/btn-secondary/)
    await assertLayout()
    const playingXiColumnMetrics = await page.evaluate(() => {
      const table = document.querySelector('.manual-team-table.manual-lineup-table')
      const playerHeader = table?.querySelector('th.manual-col-player')
      if (!table || !playerHeader) {
        return { tableWidth: 0, playerWidth: 0, ratio: 0 }
      }
      const tableWidth = table.getBoundingClientRect().width
      const playerWidth = playerHeader.getBoundingClientRect().width
      const ratio = tableWidth > 0 ? playerWidth / tableWidth : 0
      return { tableWidth, playerWidth, ratio }
    })
    expect(playingXiColumnMetrics.tableWidth).toBeGreaterThan(500)
    expect(playingXiColumnMetrics.ratio).toBeLessThan(0.4)

    // Scorecards manual entry
    await page.getByRole('tab', { name: 'Scorecards' }).click()
    await page.getByRole('tab', { name: 'Manual Entry' }).click()
    const resetScoresBtn = page.getByRole('button', { name: 'Reset Scores' })
    const saveScoresBtn = page.getByRole('button', { name: 'Save' })
    await expect(resetScoresBtn).toBeVisible()
    await expect(saveScoresBtn).toBeVisible()
    await expect(resetScoresBtn).toHaveClass(/btn-danger/)
    await expect(saveScoresBtn).toHaveClass(/btn-primary/)
    await assertLayout()
  } finally {
    await deleteContestIfPresent(request, contestId, 'master')
    await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      data: { actorUserId: 'master' },
    })
  }
})
