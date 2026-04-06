import { expect, test } from '@playwright/test'
import {
  apiCall,
  createBotUsers,
  createContest,
  deleteContestIfPresent,
  deleteUserIfPresent,
  getMasterActorUserId,
  loginUi,
  logoutUi,
  patchUserByGameName,
  registerAndActivateBot,
} from './helpers/mock-e2e.js'

test.describe('6) Contest manager score update', () => {
  test.setTimeout(120000)

  test('after role change and relogin, contest manager can save score only for scoped contest', async ({
    page,
    request,
  }) => {
    const bots = createBotUsers(`score-${Date.now()}`)
    const [abc, cde] = bots
    let contestId = ''
    let tournamentId = ''

    try {
      for (const bot of bots) await deleteUserIfPresent(request, bot.gameName)
      for (const bot of bots) await registerAndActivateBot(request, bot)

      const tournaments = await apiCall(request, 'GET', '/tournaments', undefined, 200)
      tournamentId = tournaments[0].id
      const contest = await createContest({
        request,
        tournamentId,
        name: `bot-score-${Date.now()}`,
        teams: 80,
      })
      contestId = contest.id

      const masterActorUserId = await getMasterActorUserId(request)
      await patchUserByGameName(
        request,
        cde.gameName,
        { role: 'contest_manager', contestManagerContestId: contestId },
        masterActorUserId,
      )

      await logoutUi(page)
      await loginUi(page, cde.gameName)
      await expect(page.getByRole('button', { name: 'Score Updates' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Admin Manager' })).toHaveCount(0)

      const scopedOk = await request.fetch('http://127.0.0.1:4000/admin/match-scores/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          tournamentId,
          contestId,
          matchId: 'm1',
          userId: cde.gameName,
          playerStats: [{ playerName: 'Suryakumar Yadav', runs: 21 }],
        },
      })
      expect(scopedOk.status()).toBe(200)

      const forbidden = await request.fetch('http://127.0.0.1:4000/admin/match-scores/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          tournamentId,
          contestId: `${contestId}-x`,
          matchId: 'm1',
          userId: cde.gameName,
          playerStats: [{ playerName: 'Suryakumar Yadav', runs: 10 }],
        },
      })
      expect(forbidden.status()).toBe(403)

      await patchUserByGameName(request, abc.gameName, { role: 'admin' }, masterActorUserId)
      const abcUser = await apiCall(request, 'GET', '/admin/users', undefined, 200)
      const targetCde = (abcUser || []).find((u) => u.gameName === cde.gameName)

      const promoteAttempt = await request.fetch(
        `http://127.0.0.1:4000/admin/users/${targetCde.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: abc.gameName, role: 'admin' },
        },
      )
      expect(promoteAttempt.status()).toBe(403)
    } finally {
      for (const bot of bots) await deleteUserIfPresent(request, bot.gameName)
      await deleteContestIfPresent(request, contestId)
    }
  })
})
