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
          home: 'RCB',
          away: 'SRH',
          date: '2099-06-10',
          startAt: '2099-06-10T14:00:00.000Z',
          venue: 'Bengaluru',
        },
      ],
    },
    201,
  )

test('contest open shows loading text instead of no matches flash while matches are fetching', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)

  const tag = Date.now()
  const tournamentId = `contest-open-load-tour-${tag}`
  let contestId = ''

  try {
    await createTournamentViaApi({
      request,
      tournamentId,
      name: `Contest Open Loading Tournament ${tag}`,
    })

    const contest = await createContest({
      request,
      tournamentId,
      name: `Contest Open Loading ${tag}`,
      matchIds: ['m1'],
      teams: 10,
    })
    contestId = contest.id

    await page.setViewportSize({ width: 1366, height: 768 })
    await loginUi(page, 'master')

    await page.route('**/contests/*/matches*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200))
      await route.continue()
    })

    await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(page.locator('.match-table .loading-note .loading-dots')).toBeVisible()
    await expect(page.getByText('Loading matches...')).toBeVisible()
    await expect(page.getByText('No matches found')).toHaveCount(0)

    await expect(page.locator('.match-table tbody tr').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Loading matches...')).toHaveCount(0)
  } finally {
    await deleteContestIfPresent(request, contestId, 'master')
    await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      data: { actorUserId: 'master' },
    })
  }
})
