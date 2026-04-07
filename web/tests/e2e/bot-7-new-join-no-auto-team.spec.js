import { expect, test } from '@playwright/test'
import {
  apiCall,
  createBotUsers,
  deleteContestIfPresent,
  deleteUserIfPresent,
  loginUi,
  registerAndActivateBot,
} from './helpers/mock-e2e.js'

test.describe('7) New join has no auto team', () => {
  test.setTimeout(120000)

  test('newly joined user should see add-team action for all contest matches before saving XI', async ({
    page,
    request,
  }) => {
    const [bot] = createBotUsers(`noauto-${Date.now()}`)
    const tournamentId = 't20wc-2026'
    let contestId = ''

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
      const notStartedIds = (options || [])
        .filter((row) => String(row.status).toLowerCase() === 'notstarted')
        .slice(0, 3)
        .map((row) => row.id)
      expect(notStartedIds.length).toBeGreaterThanOrEqual(1)

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `bot-noauto-${Date.now()}`,
          tournamentId,
          game: 'Fantasy',
          teams: 200,
          status: 'Open',
          matchIds: notStartedIds,
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

      await loginUi(page, bot.gameName)
      await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)
      const rows = page.locator('.match-table tbody tr')
      await expect(rows.first()).toBeVisible()

      const rowCount = await rows.count()
      expect(rowCount).toBeGreaterThan(0)
      for (let i = 0; i < rowCount; i += 1) {
        await expect(rows.nth(i).getByLabel('Add team')).toHaveCount(1)
        await expect(rows.nth(i).getByLabel('View team')).toHaveCount(0)
      }
    } finally {
      await deleteUserIfPresent(request, bot.gameName)
      await deleteContestIfPresent(request, contestId)
    }
  })
})
