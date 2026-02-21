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
        `http://127.0.0.1:4000/mock/admin/contests/${contestId}`,
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
        `/mock/admin/contests/${contestId}`,
        { actorUserId: 'admin' },
        200,
      )

      const verifyGone = await apiCall(
        request,
        'GET',
        `/mock/admin/contests/catalog?tournamentId=t20wc-2026`,
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
})
