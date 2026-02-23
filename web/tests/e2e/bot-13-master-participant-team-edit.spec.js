import { test, expect } from '@playwright/test'
import {
  apiCall,
  createContest,
  deleteContestIfPresent,
  deleteUserIfPresent,
  getMasterActorUserId,
  loginUi,
  logoutUi,
  registerAndActivateBot,
  saveSelection,
} from './helpers/mock-e2e.js'

test.describe('13) Master participant team edit and join gate', () => {
  test.setTimeout(90_000)

  test('master edits participant team; non-joined edit is blocked; admin cross-user edit blocked', async ({
    page,
    request,
  }) => {
    const suffix = `${Date.now().toString().slice(-6)}`
    const bot = {
      name: 'abc',
      gameName: `mocke2ebot-abc-${suffix}`,
      email: `mocke2ebot-abc-${suffix}@myxi.local`,
      password: 'demo123',
    }
    let contestId = ''
    let targetMatchId = ''

    try {
      await registerAndActivateBot(request, bot)

      const options = await apiCall(
        request,
        'GET',
        '/admin/contest-match-options?tournamentId=t20wc-2026',
        undefined,
        200,
      )
      targetMatchId = (options || []).find((row) => row?.selectable)?.id || ''
      expect(targetMatchId).not.toBe('')

      const created = await createContest({
        request,
        tournamentId: 't20wc-2026',
        name: `E2E Master Edit ${suffix}`,
        teams: 2,
        createdBy: 'master',
        matchIds: [targetMatchId],
      })
      contestId = created?.id || ''
      expect(contestId).not.toBe('')

      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: bot.gameName },
        200,
      )
      await saveSelection({
        request,
        contestId,
        userId: bot.gameName,
        matchId: targetMatchId,
      })

      await loginUi(page, 'master')
      await page.goto(`/tournaments/t20wc-2026/contests/${contestId}`)
      await expect(page.locator('.match-table tbody tr').first()).toBeVisible()

      const matchRow = page.locator('.match-table tbody tr').first()
      await expect(matchRow).toBeVisible()
      await expect(matchRow.getByLabel(/Edit team|Add team/)).toHaveCount(0)

      const participantRow = page
        .locator('.participants-table tbody tr', { hasText: bot.gameName })
        .first()
      await expect(participantRow).toBeVisible()
      await participantRow
        .getByRole('link', { name: `Edit ${bot.gameName} team` })
        .click()
      await expect(page).toHaveURL(
        new RegExp(`/fantasy/select\\?contest=${contestId}.*userId=${bot.gameName}`),
      )
      await expect(page.getByText(`Master edit: ${bot.gameName}`)).toBeVisible()
      await logoutUi(page)

      await loginUi(page, 'admin')
      await page.goto(
        `/fantasy/select?contest=${contestId}&match=${targetMatchId}&mode=edit&userId=${bot.gameName}`,
      )
      await expect(page.getByText(/Only master admin can/i)).toBeVisible()
    } finally {
      try {
        const actorUserId = await getMasterActorUserId(request)
        await deleteContestIfPresent(request, contestId, actorUserId)
      } catch {
        // best effort cleanup
      }
      try {
        await deleteUserIfPresent(request, bot.gameName)
      } catch {
        // best effort cleanup
      }
    }
  })
})
