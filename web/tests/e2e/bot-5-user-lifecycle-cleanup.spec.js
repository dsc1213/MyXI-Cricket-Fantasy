import { expect, test } from '@playwright/test'
import {
  apiCall,
  createBotUsers,
  deleteContestIfPresent,
  deleteUserIfPresent,
  expectUserInParticipants,
  findUserByGameName,
  getMasterActorUserId,
  getAdminUsers,
  loginUi,
  registerAndActivateBot,
  saveSelection,
} from './helpers/mock-e2e.js'

test.describe('5) User lifecycle cleanup', () => {
  test.setTimeout(120000)

  test('delete user and verify removal across admin, leaderboard, participants', async ({
    page,
    request,
  }) => {
    const [bot] = createBotUsers(`cleanup-${Date.now()}`)
    let contestId = ''
    const tournamentId = 't20wc-2026'
    let firstMatchId = 'm1'

    try {
      await deleteUserIfPresent(request, bot.gameName)
      await registerAndActivateBot(request, bot)

      const options = await apiCall(
        request,
        'GET',
        `/admin/contest-match-options?tournamentId=${tournamentId}`,
        undefined,
        200,
      )
      const matchIds = (options || [])
        .filter((row) => String(row.status).toLowerCase() === 'notstarted')
        .slice(0, 3)
        .map((row) => row.id)
      firstMatchId = matchIds[0] || 'm1'
      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `bot-cleanup-${Date.now()}`,
          tournamentId,
          game: 'Fantasy',
          teams: 200,
          status: 'Open',
          matchIds,
          createdBy: 'master',
        },
        201,
      )
      contestId = contest.id

      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: bot.gameName },
        200,
      )
      await saveSelection({ request, contestId, userId: bot.gameName, matchId: firstMatchId })

      await loginUi(page, 'master')
      await expectUserInParticipants({ page, tournamentId, contestId, gameName: bot.gameName })

      const target = await findUserByGameName(request, bot.gameName)
      const actorUserId = await getMasterActorUserId(request)
      await apiCall(
        request,
        'DELETE',
        `/admin/users/${target.id}`,
        { actorUserId },
        200,
      )

      const usersAfterDelete = await getAdminUsers(request)
      expect((usersAfterDelete || []).some((user) => user.gameName === bot.gameName)).toBe(false)

      await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)
      await expect(page.locator('.match-table tbody tr').first()).toBeVisible()
      await page.locator('.match-table tbody tr').first().click()
      await expect(
        page.locator('.participants-table tbody tr', { hasText: bot.gameName }),
      ).toHaveCount(0)
    } finally {
      await deleteUserIfPresent(request, bot.gameName)
      await deleteContestIfPresent(request, contestId)
    }
  })
})
