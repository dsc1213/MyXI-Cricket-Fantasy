import { expect, test } from '@playwright/test'
import {
  apiCall,
  createBotUsers,
  createContest,
  deleteContestIfPresent,
  deleteUserIfPresent,
  loginUi,
  registerAndActivateBot,
} from './helpers/mock-e2e.js'

test.describe('8) Contest scope and join window rules', () => {
  test.setTimeout(120000)

  test('join open/closed and match visibility follow contest rules', async ({
    page,
    request,
  }) => {
    const [bot] = createBotUsers(`scope-${Date.now()}`)
    let openContestId = ''
    let startedOnlyContestId = ''

    try {
      await deleteUserIfPresent(request, bot.gameName)
      await registerAndActivateBot(request, bot)

      const options = await apiCall(
        request,
        'GET',
        '/admin/contest-match-options?tournamentId=t20wc-2026',
        undefined,
        200,
      )
      const notStarted = (options || []).filter(
        (row) => String(row.status).toLowerCase() === 'notstarted',
      )
      const started = (options || []).filter(
        (row) => String(row.status).toLowerCase() !== 'notstarted',
      )
      expect(notStarted.length).toBeGreaterThanOrEqual(3)
      expect(started.length).toBeGreaterThanOrEqual(1)

      const scopedOpenIds = notStarted.slice(0, 3).map((row) => row.id)
      const openContest = await createContest({
        request,
        tournamentId: 't20wc-2026',
        name: `bot-scope-open-${Date.now()}`,
        teams: 200,
      })
      openContestId = openContest.id
      await apiCall(
        request,
        'POST',
        '/admin/contests/sync',
        { tournamentId: 't20wc-2026', enabledIds: [openContestId, 'huntercherry'] },
        200,
      )
      await apiCall(
        request,
        'DELETE',
        `/admin/contests/${openContestId}`,
        { actorUserId: 'master' },
        200,
      )
      const recreatedOpen = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `bot-scope-open-${Date.now()}`,
          tournamentId: 't20wc-2026',
          game: 'Fantasy',
          teams: 200,
          status: 'Open',
          matchIds: scopedOpenIds,
          createdBy: 'master',
        },
        201,
      )
      openContestId = recreatedOpen.id

      await apiCall(
        request,
        'POST',
        `/contests/${openContestId}/join`,
        { userId: bot.gameName },
        200,
      )

      const scopedMatches = await apiCall(
        request,
        'GET',
        `/contests/${openContestId}/matches?userId=${bot.gameName}`,
        undefined,
        200,
      )
      expect(scopedMatches.length).toBe(scopedOpenIds.length)
      expect(scopedMatches.every((row) => scopedOpenIds.includes(row.id))).toBe(true)

      await loginUi(page, bot.gameName)
      await page.goto(`/tournaments/t20wc-2026/contests/${openContestId}`)
      const rows = page.locator('.match-table tbody tr')
      await expect
        .poll(async () => rows.count(), { timeout: 15000 })
        .toBeGreaterThan(0)

      const startedOnlyContest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `bot-scope-closed-${Date.now()}`,
          tournamentId: 't20wc-2026',
          game: 'Fantasy',
          teams: 200,
          status: 'Open',
          matchIds: [started[0].id],
          createdBy: 'master',
        },
        201,
      )
      startedOnlyContestId = startedOnlyContest.id

      await loginUi(page, bot.gameName)
      await page.goto('/fantasy')
      const startedCard = page.locator('.compact-contest-card', {
        hasText: startedOnlyContest.name,
      })
      await expect(startedCard).toBeVisible()
      await expect(startedCard.getByRole('button', { name: 'Join' })).toBeEnabled()
      await startedCard.getByRole('button', { name: 'Join' }).click()
      await expect(page.getByText('Joined (1)')).toBeVisible()
      await expect(
        page.locator('.compact-contest-card', { hasText: startedOnlyContest.name }),
      ).toHaveCount(1)
    } finally {
      await deleteUserIfPresent(request, bot.gameName)
      await deleteContestIfPresent(request, openContestId)
      await deleteContestIfPresent(request, startedOnlyContestId)
    }
  })
})
