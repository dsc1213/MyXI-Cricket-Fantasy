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

test('contest detail sorts matches by date bucket and locks edit when start time has passed', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)

  const tag = Date.now()
  const tournamentId = `date-sort-lock-tour-${tag}`
  let contestId = ''

  const now = new Date()
  const todayStarted = new Date(now.getTime() - 22 * 60 * 1000)
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const matches = [
    {
      id: 'm1',
      matchNo: 1,
      home: 'MI',
      away: 'CSK',
      date: yesterday.toISOString().slice(0, 10),
      startAt: yesterday.toISOString(),
      venue: 'Chennai',
      status: 'completed',
    },
    {
      id: 'm2',
      matchNo: 2,
      home: 'KKR',
      away: 'SRH',
      date: todayStarted.toISOString().slice(0, 10),
      startAt: todayStarted.toISOString(),
      venue: 'Kolkata',
      status: 'notstarted',
    },
    {
      id: 'm3',
      matchNo: 3,
      home: 'RCB',
      away: 'GT',
      date: tomorrow.toISOString().slice(0, 10),
      startAt: tomorrow.toISOString(),
      venue: 'Bengaluru',
      status: 'notstarted',
    },
  ]

  try {
    await createTournamentViaApi({
      request,
      tournamentId,
      name: `Date Sort Lock Tournament ${tag}`,
      matches,
    })

    const contest = await createContest({
      request,
      tournamentId,
      name: `Date Sort Lock Contest ${tag}`,
      matchIds: ['m1', 'm2', 'm3'],
    })
    contestId = contest.id

    await apiCall(
      request,
      'POST',
      `/contests/${contestId}/join`,
      { userId: 'master' },
      200,
    )

    const apiMatches = await apiCall(
      request,
      'GET',
      `/contests/${contestId}/matches?userId=master`,
      undefined,
      200,
    )
    const startedMatchFromApi = (apiMatches || []).find((row) => row.id === 'm2')
    expect(String(startedMatchFromApi?.status || '').toLowerCase()).toBe('inprogress')

    await loginUi(page, 'master')
    await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`, {
      waitUntil: 'domcontentloaded',
    })

    await expect(
      page.locator('.match-table tbody tr', { hasText: /kkr\s*vs\s*srh/i }).first(),
    ).toBeVisible()

    const rows = page.locator('.match-table tbody tr')

    const firstRowText = (await rows.first().innerText()).toLowerCase()
    expect(firstRowText).toContain('kkr')
    expect(firstRowText).toContain('srh')

    const startedRow = page
      .locator('.match-table tbody tr', { hasText: /kkr\s*vs\s*srh/i })
      .first()
    await expect(startedRow).toBeVisible()
    await expect(startedRow).toContainText(/In Progress/i)
    await expect(startedRow.getByLabel(/Edit team|Add team/i)).toHaveCount(0)
  } finally {
    await deleteContestIfPresent(request, contestId, 'master')
    await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      data: { actorUserId: 'master' },
    })
  }
})
