import { expect, test } from '@playwright/test'
import {
  apiCall,
  createBotUsers,
  createContest,
  deleteContestIfPresent,
  deleteUserIfPresent,
  registerAndActivateBot,
  saveSelection,
} from './helpers/mock-e2e.js'

test.describe('4) Multi-contest visibility', () => {
  test.setTimeout(120000)

  test('users joined across multiple contests appear in leaderboard and participants', async ({
    request,
  }) => {
    const bots = createBotUsers(`multi-${Date.now()}`)
    const [abc, cde, efg] = bots
    const contestIds = []

    try {
      for (const bot of bots) await deleteUserIfPresent(request, bot.gameName)
      for (const bot of bots) await registerAndActivateBot(request, bot)

      const tournaments = await apiCall(request, 'GET', '/mock/tournaments', undefined, 200)
      const selectedTournaments = (tournaments || []).slice(0, 3)
      expect(selectedTournaments.length).toBe(3)

      const contests = []
      for (let i = 0; i < selectedTournaments.length; i += 1) {
        const contest = await createContest({
          request,
          tournamentId: selectedTournaments[i].id,
          name: `bot-visibility-${i + 1}-${Date.now()}`,
          teams: 500,
        })
        contests.push({ contestId: contest.id, tournamentId: selectedTournaments[i].id })
        contestIds.push(contest.id)
      }

      const [contestA, contestB, contestC] = contests
      await saveSelection({ request, contestId: contestA.contestId, userId: abc.gameName })
      await saveSelection({ request, contestId: contestB.contestId, userId: abc.gameName })
      await saveSelection({ request, contestId: contestB.contestId, userId: cde.gameName })
      await saveSelection({ request, contestId: contestC.contestId, userId: cde.gameName })
      await saveSelection({ request, contestId: contestA.contestId, userId: efg.gameName })
      await saveSelection({ request, contestId: contestC.contestId, userId: efg.gameName })

      for (const [gameName, contest] of [
        [abc.gameName, contestA],
        [cde.gameName, contestB],
        [efg.gameName, contestC],
      ]) {
        const contestMatches = await apiCall(
          request,
          'GET',
          `/mock/contests/${contest.contestId}/matches?userId=${gameName}`,
          undefined,
          200,
        )
        const activeMatchId = (contestMatches || [])[0]?.id || 'm1'
        const board = await apiCall(
          request,
          'GET',
          `/mock/contests/${contest.contestId}/leaderboard`,
          undefined,
          200,
        )
        expect((board.rows || []).some((row) => row.userId === gameName)).toBe(true)

        const participants = await apiCall(
          request,
          'GET',
          `/mock/contests/${contest.contestId}/participants?matchId=${activeMatchId}&userId=master`,
          undefined,
          200,
        )
        expect((participants.participants || []).some((row) => row.userId === gameName)).toBe(
          true,
        )
      }
    } finally {
      for (const bot of bots) {
        await deleteUserIfPresent(request, bot.gameName)
      }
      for (const contestId of contestIds) {
        await deleteContestIfPresent(request, contestId)
      }
    }
  })
})
