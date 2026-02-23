import { expect, test } from '@playwright/test'
import {
  apiCall,
  createBotUsers,
  deleteContestIfPresent,
  deleteUserIfPresent,
  loginUi,
  registerAndActivateBot,
  saveSelection,
} from './helpers/mock-e2e.js'

test.describe('9) Capacity and participants sync', () => {
  test.setTimeout(120000)

  test('contest card capacity and participants are driven by submitted match teams', async ({
    page,
    request,
  }) => {
    const [botA, botB] = createBotUsers(`cap-sync-${Date.now()}`)
    const tournamentId = 't20wc-2026'
    const contestName = `bot-capacity-sync-${Date.now()}`
    let contestId = ''

    try {
      await deleteUserIfPresent(request, botA.gameName)
      await deleteUserIfPresent(request, botB.gameName)
      await registerAndActivateBot(request, botA)
      await registerAndActivateBot(request, botB)

      const options = await apiCall(
        request,
        'GET',
        `/admin/contest-match-options?tournamentId=${tournamentId}`,
        undefined,
        200,
      )
      const notStartedIds = (options || [])
        .filter((row) => String(row.status).toLowerCase() === 'notstarted')
        .slice(0, 2)
        .map((row) => row.id)
      expect(notStartedIds.length).toBe(2)

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: contestName,
          tournamentId,
          game: 'Fantasy',
          teams: 2,
          status: 'Open',
          createdBy: 'master',
          matchIds: notStartedIds,
        },
        201,
      )
      contestId = contest.id

      await apiCall(request, 'POST', `/contests/${contestId}/join`, { userId: botA.gameName }, 200)
      await apiCall(request, 'POST', `/contests/${contestId}/join`, { userId: botB.gameName }, 200)

      await loginUi(page, 'sreecharan')
      await page.goto('/fantasy')

      const card = page.locator('article.compact-contest-card', { hasText: contestName }).first()
      await expect(card).toBeVisible()
      await expect(card).toContainText('Participants 2 / 2')
      await expect(card.getByRole('button', { name: 'Contest full' })).toBeVisible()

      await card.getByRole('link', { name: 'Open contest' }).click()
      await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}/contests/${contestId}$`))

      await expect(page.getByRole('heading', { name: /Participants \(0 \/ 2 joined\)/ })).toBeVisible()
      const participantRows = page.locator('.participants-table tbody tr')
      await expect(participantRows.filter({ hasText: botA.gameName })).toHaveCount(0)
      await expect(participantRows.filter({ hasText: botB.gameName })).toHaveCount(0)
      await expect(participantRows.filter({ hasText: 'sreecharan' })).toHaveCount(0)

      await saveSelection({
        request,
        contestId,
        userId: botA.gameName,
        matchId: notStartedIds[0],
      })

      await page.reload()
      await expect(page.getByRole('heading', { name: /Participants \(1 \/ 2 joined\)/ })).toBeVisible()
      await expect(participantRows.filter({ hasText: botA.gameName })).toHaveCount(1)
      await expect(participantRows.filter({ hasText: botB.gameName })).toHaveCount(0)
      await expect(participantRows.filter({ hasText: 'sreecharan' })).toHaveCount(0)
    } finally {
      await deleteContestIfPresent(request, contestId)
      await deleteUserIfPresent(request, botA.gameName)
      await deleteUserIfPresent(request, botB.gameName)
    }
  })
})
