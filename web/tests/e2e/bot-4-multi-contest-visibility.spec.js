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

  test('saving a team in one contest does not move the same match selection out of another contest', async ({
    request,
  }) => {
    const tag = Date.now()
    let contestAId = ''
    let contestBId = ''

    try {
      const tournamentId = 't20wc-2026'
      const contestA = await createContest({
        request,
        tournamentId,
        name: `bot-multi-save-a-${tag}`,
        teams: 120,
        createdBy: 'master',
      })
      contestAId = contestA.id

      const contestB = await createContest({
        request,
        tournamentId,
        name: `bot-multi-save-b-${tag}`,
        teams: 120,
        createdBy: 'master',
      })
      contestBId = contestB.id

      const contestAMatches = await apiCall(
        request,
        'GET',
        `/contests/${contestAId}/matches?userId=player`,
        undefined,
        200,
      )
      const sharedMatchId = (contestAMatches || [])[0]?.id
      expect(sharedMatchId).toBeTruthy()

      await apiCall(request, 'POST', `/contests/${contestAId}/join`, { userId: 'player' }, 200)
      await apiCall(request, 'POST', `/contests/${contestBId}/join`, { userId: 'player' }, 200)

      await saveSelection({
        request,
        contestId: contestAId,
        userId: 'player',
        matchId: sharedMatchId,
      })
      await saveSelection({
        request,
        contestId: contestBId,
        userId: 'player',
        matchId: sharedMatchId,
      })

      const selectionA = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestAId}&matchId=${sharedMatchId}&userId=player`,
        undefined,
        200,
      )
      const selectionB = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestBId}&matchId=${sharedMatchId}&userId=player`,
        undefined,
        200,
      )

      expect((selectionA?.selection?.playingXi || []).length).toBe(11)
      expect((selectionB?.selection?.playingXi || []).length).toBe(11)
    } finally {
      await deleteContestIfPresent(request, contestAId)
      await deleteContestIfPresent(request, contestBId)
    }
  })

  test('users joined across multiple contests appear in leaderboard and participants', async ({
    request,
  }) => {
    const bots = createBotUsers(`multi-${Date.now()}`)
    const [abc, cde, efg] = bots
    const contestIds = []

    try {
      for (const bot of bots) await deleteUserIfPresent(request, bot.gameName)
      for (const bot of bots) await registerAndActivateBot(request, bot)

      const tournaments = await apiCall(request, 'GET', '/tournaments', undefined, 200)
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
          `/contests/${contest.contestId}/matches?userId=${gameName}`,
          undefined,
          200,
        )
        const activeMatchId = (contestMatches || [])[0]?.id || 'm1'
        const board = await apiCall(
          request,
          'GET',
          `/contests/${contest.contestId}/leaderboard`,
          undefined,
          200,
        )
        expect((board.rows || []).some((row) => row.userId === gameName)).toBe(true)

        const participants = await apiCall(
          request,
          'GET',
          `/contests/${contest.contestId}/participants?matchId=${activeMatchId}&userId=master`,
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
