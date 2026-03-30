import { expect, test } from '@playwright/test'
import {
  apiCall,
  createBotUsers,
  createContest,
  deleteContestIfPresent,
  deleteUserIfPresent,
  getMasterActorUserId,
  patchUserByGameName,
  registerAndActivateBot,
  saveSelection,
} from './helpers/mock-e2e.js'

test.describe('9) Admin contest delete ownership', () => {
  test.setTimeout(120000)

  test('admin B cannot delete contest created by admin A; master can', async ({ request }) => {
    const [botAdminB] = createBotUsers(`admindel-${Date.now()}`)
    let contestId = ''

    try {
      await deleteUserIfPresent(request, botAdminB.gameName)
      await registerAndActivateBot(request, botAdminB)

      const masterActorUserId = await getMasterActorUserId(request)
      await patchUserByGameName(
        request,
        botAdminB.gameName,
        { role: 'admin' },
        masterActorUserId,
      )

      const contest = await createContest({
        request,
        tournamentId: 't20wc-2026',
        name: `bot-admin-owner-${Date.now()}`,
        teams: 200,
        createdBy: 'admin',
      })
      contestId = contest.id

      const forbiddenDelete = await request.fetch(
        `http://127.0.0.1:4000/admin/contests/${contestId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: botAdminB.gameName },
        },
      )
      expect(forbiddenDelete.status()).toBe(403)

      await apiCall(
        request,
        'DELETE',
        `/admin/contests/${contestId}`,
        { actorUserId: 'admin' },
        200,
      )

      const verifyGone = await apiCall(
        request,
        'GET',
        `/admin/contests/catalog?tournamentId=t20wc-2026`,
        undefined,
        200,
      )
      expect((verifyGone || []).some((row) => row.id === contestId && row.enabled)).toBe(false)

      contestId = ''
    } finally {
      await deleteUserIfPresent(request, botAdminB.gameName)
      await deleteContestIfPresent(request, contestId, 'master')
    }
  })

  test('deleting one contest does not remove the same participant from another contest', async ({
    request,
  }) => {
    const contestNameTag = Date.now()
    let contestAId = ''
    let contestBId = ''

    try {
      const contestA = await createContest({
        request,
        tournamentId: 't20wc-2026',
        name: `bot-delete-scope-a-${contestNameTag}`,
        teams: 80,
        createdBy: 'master',
      })
      contestAId = contestA.id

      const contestB = await createContest({
        request,
        tournamentId: 't20wc-2026',
        name: `bot-delete-scope-b-${contestNameTag}`,
        teams: 80,
        createdBy: 'master',
      })
      contestBId = contestB.id

      await apiCall(request, 'POST', `/contests/${contestAId}/join`, { userId: 'player' }, 200)
      await apiCall(request, 'POST', `/contests/${contestBId}/join`, { userId: 'player' }, 200)
      await saveSelection({ request, contestId: contestAId, userId: 'player' })
      await saveSelection({ request, contestId: contestBId, userId: 'player' })
      const contestBMatches = await apiCall(
        request,
        'GET',
        `/contests/${contestBId}/matches?userId=player`,
        undefined,
        200,
      )
      const contestBMatchId = (contestBMatches || [])[0]?.id
      expect(contestBMatchId).toBeTruthy()

      const beforeDeleteB = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestBId}&matchId=${contestBMatchId}&userId=player`,
        undefined,
        200,
      )
      expect((beforeDeleteB?.selection?.playingXi || []).length).toBeGreaterThan(0)

      await apiCall(
        request,
        'DELETE',
        `/admin/contests/${contestAId}`,
        { actorUserId: 'master' },
        200,
      )
      contestAId = ''

      const remainingSelection = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestBId}&matchId=${contestBMatchId}&userId=player`,
        undefined,
        200,
      )
      expect((remainingSelection?.selection?.playingXi || []).length).toBeGreaterThan(0)
    } finally {
      await deleteContestIfPresent(request, contestAId, 'master')
      await deleteContestIfPresent(request, contestBId, 'master')
    }
  })
})
