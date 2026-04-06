import { expect, test } from '@playwright/test'
import {
  apiCall,
  createContest,
  deleteContestIfPresent,
  loginUi,
} from './helpers/mock-e2e.js'

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

test('playing xi manual entry lets selecting the last player row on mobile', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)

  const tag = Date.now()
  const tournamentId = `lineup-scroll-tour-${tag}`
  let contestId = ''

  try {
    await createTournamentViaApi({
      request,
      tournamentId,
      name: `Lineup Scroll Tournament ${tag}`,
    })

    const contest = await createContest({
      request,
      tournamentId,
      name: `Lineup Scroll Contest ${tag}`,
      matchIds: ['m1'],
    })
    contestId = contest.id

    await page.setViewportSize({ width: 390, height: 844 })
    await loginUi(page, 'master')
    await page.goto('/home?panel=upload', { waitUntil: 'domcontentloaded' })

    const scopeRow = page.locator('.manual-scope-row')
    await scopeRow.getByLabel('Tournament').selectOption(tournamentId)
    await scopeRow.getByLabel('Match').selectOption('m1')
    await expect(page.getByText('Loading playing XI...')).toHaveCount(0)

    const firstTeamCard = page.locator('.manual-lineup-card').first()
    await expect(firstTeamCard).toBeVisible()

    const tableWrap = firstTeamCard.locator('.manual-team-table-wrap')
    await expect(tableWrap).toBeVisible()

    const metrics = await tableWrap.evaluate((node) => ({
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      overflowY: window.getComputedStyle(node).overflowY,
    }))

    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight)
    expect(['auto', 'scroll']).toContain(metrics.overflowY)

    const checkboxes = firstTeamCard.locator(
      '.manual-lineup-table tbody input[type="checkbox"]',
    )
    const checkboxCount = await checkboxes.count()
    expect(checkboxCount).toBeGreaterThan(11)

    await tableWrap.evaluate((node) => {
      node.scrollTop = node.scrollHeight
    })

    const lastRowBottomGap = await firstTeamCard.evaluate((card) => {
      const wrap = card.querySelector('.manual-team-table-wrap')
      const rows = card.querySelectorAll('.manual-lineup-table tbody tr')
      const lastRow = rows[rows.length - 1]
      if (!wrap || !lastRow) return 0
      const wrapRect = wrap.getBoundingClientRect()
      const lastRowRect = lastRow.getBoundingClientRect()
      return Math.max(0, wrapRect.bottom - lastRowRect.bottom)
    })
    expect(lastRowBottomGap).toBeGreaterThan(4)

    const lastCheckbox = checkboxes.nth(checkboxCount - 1)
    await expect(lastCheckbox).toBeVisible()
    await expect(lastCheckbox).toBeEnabled()
    await lastCheckbox.check()
    await expect(lastCheckbox).toBeChecked()
  } finally {
    await deleteContestIfPresent(request, contestId, 'master')
    await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      data: { actorUserId: 'master' },
    })
  }
})
