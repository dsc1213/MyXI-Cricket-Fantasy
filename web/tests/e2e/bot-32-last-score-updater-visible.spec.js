import { expect, test } from '@playwright/test'
import {
  apiCall,
  createContest,
  deleteContestIfPresent,
  loginUi,
} from './helpers/mock-e2e.js'

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

test('fantasy contest tile shows last score update timestamp and updater', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)

  const tag = Date.now()
  const tournamentId = `last-score-meta-tour-${tag}`
  const tournamentName = `Last Score Meta Tournament ${tag}`
  const contestName = `Last Score Meta Contest ${tag}`
  let contestId = ''

  try {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await createTournamentViaApi({
      request,
      tournamentId,
      name: tournamentName,
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

    const contestsApi = await apiCall(
      request,
      'GET',
      `/contests?game=Fantasy&tournamentId=${encodeURIComponent(tournamentId)}&userId=master`,
      undefined,
      200,
    )
    const apiContest = (contestsApi || []).find(
      (row) => String(row.id) === String(contestId),
    )
    expect(apiContest?.lastScoreUpdatedAt).toBeTruthy()
    expect(String(apiContest?.lastScoreUpdatedBy || '').trim().length).toBeGreaterThan(0)

    await loginUi(page, 'master')
    await page.goto('/fantasy', { waitUntil: 'domcontentloaded' })

    const tournamentTile = page
      .locator('.tournament-filter-tile', { hasText: tournamentName })
      .first()
    await expect(tournamentTile).toBeVisible()
    await tournamentTile.click()

    const contestCard = page
      .locator('.compact-contest-card', { hasText: contestName })
      .first()
    await expect(contestCard).toBeVisible()

    const scoreMetaLine = contestCard.locator('.team-note', {
      hasText: 'Last score update:',
    })
    await expect(scoreMetaLine).toBeVisible()
    await expect(scoreMetaLine).not.toContainText('Last score update: -')
    await expect(scoreMetaLine).toContainText(/by\s+\S+/i)
  } finally {
    await deleteContestIfPresent(request, contestId, 'master')
    await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      data: { actorUserId: 'master' },
    })
  }
})
