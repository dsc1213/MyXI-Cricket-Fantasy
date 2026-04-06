import { expect, test } from '@playwright/test'
import {
  apiCall,
  createContest,
  deleteContestIfPresent,
  loginUi,
} from './helpers/mock-e2e.js'

const createTournamentViaApi = async ({ request, tournamentId, name, matches }) =>
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
      matches,
    },
    201,
  )

test('contest matches card scrolls horizontally on mobile without shrinking rows', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)

  const tag = Date.now()
  const tournamentId = `mobile-filters-tour-${tag}`
  let contestId = ''

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

  try {
    await createTournamentViaApi({
      request,
      tournamentId,
      name: `Mobile Filters Tournament ${tag}`,
      matches: [
        {
          id: 'm1',
          matchNo: 1,
          home: 'KKR',
          away: 'SRH',
          date: tomorrow.toISOString().slice(0, 10),
          startAt: tomorrow.toISOString(),
          venue: 'Kolkata',
          status: 'notstarted',
        },
      ],
    })

    const contest = await createContest({
      request,
      tournamentId,
      name: `Mobile Filters Contest ${tag}`,
      matchIds: ['m1'],
    })
    contestId = contest.id

    await page.setViewportSize({ width: 390, height: 844 })
    await loginUi(page, 'master')
    await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`, {
      waitUntil: 'domcontentloaded',
    })

    const matchesCard = page.locator('.contest-detail .matches-card').first()
    await expect(matchesCard).toBeVisible()

    const filtersRail = page.locator('.matches-card .match-filters-scroll').first()
    await expect(filtersRail).toBeVisible()

    const cardMetrics = await matchesCard.evaluate((node) => ({
      overflowX: window.getComputedStyle(node).overflowX,
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }))

    expect(['auto', 'scroll']).toContain(cardMetrics.overflowX)
    expect(cardMetrics.scrollWidth).toBeGreaterThan(cardMetrics.clientWidth)

    const metrics = await filtersRail.evaluate((node) => ({
      overflowX: window.getComputedStyle(node).overflowX,
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }))

    expect(metrics.overflowX).toBe('visible')

    const tableMetrics = await page.locator('.matches-card .match-table').first().evaluate((node) => ({
      width: node.getBoundingClientRect().width,
    }))
    expect(tableMetrics.width).toBeGreaterThan(700)

    const tableWrapMetrics = await page
      .locator('.matches-card .match-table-wrap')
      .first()
      .evaluate((node) => ({
        overflowX: window.getComputedStyle(node).overflowX,
      }))
    expect(tableWrapMetrics.overflowX).toBe('hidden')

    await matchesCard.evaluate((node) => {
      node.scrollLeft = node.scrollWidth
    })

    await expect(
      page.locator('.matches-card .match-filters-scroll').getByRole('button', {
        name: 'Preview leaderboard',
      }),
    ).toBeVisible()
  } finally {
    await deleteContestIfPresent(request, contestId, 'master')
    await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      data: { actorUserId: 'master' },
    })
  }
})
