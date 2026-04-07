import { expect, test } from '@playwright/test'
import {
  apiCall,
  createContest,
  createBotUsers,
  deleteContestIfPresent,
  deleteUserIfPresent,
  loginUi,
  registerAndActivateBot,
  saveSelection,
} from './helpers/mock-e2e.js'

test.describe('39) Fantasy cross-user team visibility', () => {
  test('before match start, joined users can only view own team and non-joined users cannot view any team', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `fantasy-cross-view-tour-${tag}`
    const contestName = `fantasy-cross-view-${tag}`
    const outsider = createBotUsers(tag)[0]
    let contestId = ''

    try {
      await registerAndActivateBot(request, outsider)

      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `Fantasy Cross View Tournament ${tag}`,
          season: '2026',
          source: 'json',
          tournamentType: 'international',
          selectedTeams: ['IND', 'AUS'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'IND',
              away: 'AUS',
              startAt: '2099-03-10T14:00:00.000Z',
              timezone: 'UTC',
              venue: 'Melbourne',
            },
          ],
        },
        201,
      )

      const contest = await createContest({
        request,
        tournamentId,
        name: contestName,
        teams: 25,
        createdBy: 'master',
        matchIds: ['m1'],
      })
      contestId = contest.id

      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: 'huntercherryxi' },
        200,
      )
      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: 'draker' },
        200,
      )
      await saveSelection({ request, contestId, userId: 'huntercherryxi' })
      await saveSelection({ request, contestId, userId: 'draker' })

      await loginUi(page, 'draker')
      await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)
      await expect(page.locator('.match-table tbody tr').first()).toBeVisible()

      const hunterRow = page
        .locator('.participants-table tbody tr', { hasText: 'HunterCherryXI' })
        .first()
      const drakerRow = page
        .locator('.participants-table tbody tr', { hasText: /draker/i })
        .first()
      await expect(hunterRow).toBeVisible()
      await expect(drakerRow).toBeVisible()
      await expect(hunterRow.getByRole('link', { name: /Edit .* team/i })).toHaveCount(0)

      await expect(
        hunterRow.getByRole('button', { name: 'View HunterCherryXI team' }),
      ).toBeDisabled()
      await expect(drakerRow.getByRole('button', { name: /View .* team/i })).toBeEnabled()

      await drakerRow.getByRole('button', { name: /View .* team/i }).click()
      await expect(page.locator('.team-preview-drawer.open')).toBeVisible()

      await loginUi(page, outsider.gameName)
      await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)
      await expect(page.locator('.participants-table tbody tr').first()).toBeVisible()

      const outsiderHunterRow = page
        .locator('.participants-table tbody tr', { hasText: 'HunterCherryXI' })
        .first()
      const outsiderDrakerRow = page
        .locator('.participants-table tbody tr', { hasText: /draker/i })
        .first()
      await expect(
        outsiderHunterRow.getByRole('button', { name: 'View HunterCherryXI team' }),
      ).toBeDisabled()
      await expect(
        outsiderDrakerRow.getByRole('button', { name: /View .* team/i }),
      ).toBeDisabled()
    } finally {
      await deleteContestIfPresent(request, contestId, 'master')
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
      await deleteUserIfPresent(request, outsider.gameName)
    }
  })
})
