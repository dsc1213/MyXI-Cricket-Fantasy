import { expect, test } from '@playwright/test'
import { apiCall, createContest, deleteContestIfPresent } from './helpers/mock-e2e.js'

const E2E_API_BASE = process.env.PW_E2E_API_BASE_URL || 'http://127.0.0.1:4000'

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

test('admin can reset match scores and clear contest last score update meta', async ({
  request,
}) => {
  test.setTimeout(120000)

  const tag = Date.now()
  const tournamentId = `reset-scores-tour-${tag}`
  const contestName = `Reset Scores Contest ${tag}`
  let contestId = ''

  try {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await createTournamentViaApi({
      request,
      tournamentId,
      name: `Reset Scores Tournament ${tag}`,
      matches: [
        {
          id: 'm1',
          matchNo: 1,
          home: 'RCB',
          away: 'MI',
          date: tomorrow.toISOString().slice(0, 10),
          startAt: tomorrow.toISOString(),
          venue: 'Bengaluru',
          status: 'notstarted',
        },
      ],
    })

    const contest = await createContest({
      request,
      tournamentId,
      name: contestName,
      matchIds: ['m1'],
    })
    contestId = contest.id

    await apiCall(
      request,
      'POST',
      '/admin/match-scores/upsert',
      {
        actorUserId: 'master',
        userId: 'master',
        tournamentId,
        matchId: 'm1',
        playerStats: [{ playerName: 'Virat Kohli', runs: 31 }],
      },
      200,
    )

    const contestsBeforeReset = await apiCall(
      request,
      'GET',
      `/contests?game=Fantasy&tournamentId=${encodeURIComponent(tournamentId)}&userId=master`,
      undefined,
      200,
    )

    const contestBefore = (contestsBeforeReset || []).find(
      (row) => String(row.id) === String(contestId),
    )
    expect(contestBefore?.lastScoreUpdatedAt).toBeTruthy()

    const resetResult = await apiCall(
      request,
      'POST',
      '/admin/match-scores/reset',
      {
        actorUserId: 'master',
        userId: 'master',
        tournamentId,
        matchId: 'm1',
      },
      200,
    )

    expect(resetResult?.ok).toBeTruthy()
    expect(String(resetResult?.matchId || '')).toBe('m1')

    const contestsAfterReset = await apiCall(
      request,
      'GET',
      `/contests?game=Fantasy&tournamentId=${encodeURIComponent(tournamentId)}&userId=master`,
      undefined,
      200,
    )

    const contestAfter = (contestsAfterReset || []).find(
      (row) => String(row.id) === String(contestId),
    )
    expect(contestAfter).toBeTruthy()
    expect(contestAfter?.lastScoreUpdatedAt || null).toBeNull()
    expect(contestAfter?.lastScoreUpdatedBy || null).toBeNull()
  } finally {
    await deleteContestIfPresent(request, contestId, 'master')
    await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      data: { actorUserId: 'master' },
    })
  }
})
