import { expect, test } from '@playwright/test'
import {
  apiCall,
  createBotUsers,
  deleteUserIfPresent,
  findUserByGameName,
  getMasterActorUserId,
  patchUserByGameName,
  registerAndActivateBot,
} from './helpers/mock-e2e.js'

test.describe('3) Role assignment policy', () => {
  test.setTimeout(120000)

  test('only master can assign admin; admin can assign contest manager', async ({ request }) => {
    const bots = createBotUsers(`roles-${Date.now()}`)
    const [abc, cde, efg] = bots

    try {
      for (const bot of bots) await deleteUserIfPresent(request, bot.gameName)
      for (const bot of bots) await registerAndActivateBot(request, bot)

      const masterActorUserId = await getMasterActorUserId(request)

      await patchUserByGameName(request, abc.gameName, { role: 'admin' }, masterActorUserId)
      const cdeUser = await patchUserByGameName(
        request,
        cde.gameName,
        { role: 'contest_manager', contestManagerContestId: 'huntercherry' },
        masterActorUserId,
      )
      await patchUserByGameName(request, efg.gameName, { role: 'user' }, masterActorUserId)
      expect(cdeUser.role).toBe('contest_manager')

      const efgUser = await findUserByGameName(request, efg.gameName)
      const adminAssignContestManager = await request.fetch(
        `http://127.0.0.1:4000/mock/admin/users/${efgUser.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: abc.gameName, role: 'contest_manager' },
        },
      )
      expect(adminAssignContestManager.status()).toBe(200)

      const efgUserAfterAdmin = await apiCall(
        request,
        'GET',
        '/mock/admin/users',
        undefined,
        200,
      )
      const foundEfg = (efgUserAfterAdmin || []).find((user) => user.gameName === efg.gameName)
      expect(foundEfg?.role).toBe('contest_manager')

      const targetCde = (efgUserAfterAdmin || []).find((user) => user.gameName === cde.gameName)
      const forbiddenPromote = await request.fetch(
        `http://127.0.0.1:4000/mock/admin/users/${targetCde.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: abc.gameName, role: 'admin' },
        },
      )
      expect(forbiddenPromote.status()).toBe(403)
    } finally {
      for (const bot of bots) {
        await deleteUserIfPresent(request, bot.gameName)
      }
    }
  })
})
