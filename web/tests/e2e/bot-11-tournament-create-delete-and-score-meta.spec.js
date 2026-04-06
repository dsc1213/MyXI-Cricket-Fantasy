import { expect, test } from '@playwright/test'
import {
  apiCall,
  createBotUsers,
  deleteUserIfPresent,
  registerAndActivateBot,
} from './helpers/mock-e2e.js'

test.describe('11) Tournament CRUD and score metadata', () => {
  test.setTimeout(120000)

  test('admin can create/delete tournament and score update reflects on contest metadata', async ({
    request,
  }) => {
    const [bot] = createBotUsers(`tournament-${Date.now()}`)
    const tournamentId = `bot-tournament-${Date.now()}`
    let contestId = ''

    try {
      await deleteUserIfPresent(request, bot.gameName)
      await registerAndActivateBot(request, bot)

      const createTournament = await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `Bot Tournament ${Date.now()}`,
          season: '2026',
          source: 'manual',
          matches: [
            {
              matchNo: 1,
              id: 'm1',
              home: 'IND',
              away: 'AUS',
              date: '2099-01-10',
              startAt: '2099-01-10T14:00:00.000Z',
              venue: 'Bot Venue 1',
            },
            {
              matchNo: 2,
              id: 'm2',
              home: 'ENG',
              away: 'NZ',
              date: '2099-01-11',
              startAt: '2099-01-11T14:00:00.000Z',
              venue: 'Bot Venue 2',
            },
          ],
        },
        201,
      )
      expect(createTournament.ok).toBe(true)
      expect(createTournament.tournament.id).toBe(tournamentId)

      const createdContest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `Bot Contest ${Date.now()}`,
          tournamentId,
          game: 'Fantasy',
          teams: 20,
          status: 'Open',
          joined: false,
          matchIds: ['m1', 'm2'],
          createdBy: 'master',
        },
        201,
      )
      contestId = createdContest.id

      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: bot.gameName },
        200,
      )

      const saveScore = await apiCall(
        request,
        'POST',
        '/admin/match-scores/upsert',
        {
          tournamentId,
          contestId,
          matchId: 'm1',
          userId: 'master',
          playerStats: [
            {
              playerName: 'Suryakumar Yadav',
              runs: 45,
              fours: 4,
              sixes: 2,
              wickets: 0,
              catches: 0,
            },
          ],
        },
        200,
      )
      expect(Number(saveScore.impactedContests || 0)).toBeGreaterThan(0)
      expect(saveScore.lastScoreUpdatedAt).toBeTruthy()

      const contests = await apiCall(
        request,
        'GET',
        `/contests?game=Fantasy&tournamentId=${tournamentId}&userId=master`,
        undefined,
        200,
      )
      const target = (contests || []).find((row) => row.id === contestId)
      expect(target).toBeTruthy()
      expect(target.lastScoreUpdatedAt).toBeTruthy()

      const deleteTournament = await apiCall(
        request,
        'DELETE',
        `/admin/tournaments/${tournamentId}`,
        { actorUserId: 'master' },
        200,
      )
      expect(deleteTournament.ok).toBe(true)

      const catalogAfter = await apiCall(
        request,
        'GET',
        '/admin/tournaments/catalog',
        undefined,
        200,
      )
      expect((catalogAfter || []).some((row) => row.id === tournamentId)).toBe(false)

      const contestsAfter = await apiCall(
        request,
        'GET',
        `/admin/contests/catalog?tournamentId=${tournamentId}`,
        undefined,
        200,
      )
      expect((contestsAfter || []).some((row) => row.id === contestId && row.enabled)).toBe(false)
    } finally {
      await deleteUserIfPresent(request, bot.gameName)
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })
})
