import { expect, test } from '@playwright/test'

const MASTER_USER = 'master'
const PASSWORD = 'demo123'

const BOT_USERS = [
  {
    name: 'abc',
    gameName: 'mocke2ebot-abc',
    email: 'mocke2ebot-abc@myxi.local',
    password: PASSWORD,
    securityAnswers: ['abc-school', 'abc-cricketer', 'abc-city'],
  },
  {
    name: 'cde',
    gameName: 'mocke2ebot-cde',
    email: 'mocke2ebot-cde@myxi.local',
    password: PASSWORD,
    securityAnswers: ['cde-school', 'cde-cricketer', 'cde-city'],
  },
  {
    name: 'efg',
    gameName: 'mocke2ebot-efg',
    email: 'mocke2ebot-efg@myxi.local',
    password: PASSWORD,
    securityAnswers: ['efg-school', 'efg-cricketer', 'efg-city'],
  },
]

const apiCall = async (request, method, path, body, expectedStatus = 200) => {
  let lastError = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await request.fetch(`http://127.0.0.1:4000${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        data: body,
      })
      if (response.status() !== expectedStatus) {
        const text = await response.text()
        throw new Error(
          `${method} ${path} expected ${expectedStatus}, got ${response.status()} :: ${text}`,
        )
      }
      return response.json().catch(() => ({}))
    } catch (error) {
      lastError = error
      if (!`${error}`.includes('ECONNRESET') || attempt === 2) break
    }
  }
  throw lastError || new Error(`${method} ${path} failed`)
}

const loginUi = async (page, userId, password = PASSWORD) => {
  const response = await page.request.fetch('http://127.0.0.1:4000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: {
      userId,
      password,
    },
  })
  if (response.status() !== 200) {
    const body = await response.text()
    throw new Error(`UI login bootstrap failed for ${userId}: ${response.status()} ${body}`)
  }
  const session = await response.json()
  await page.goto('/login')
  await page.evaluate((sessionData) => {
    window.localStorage.setItem(
      'myxi-user',
      JSON.stringify({
        ...sessionData,
        token: undefined,
      }),
    )
  }, session)
  await page.goto('/home')
  await expect(page).toHaveURL(/\/home/, { timeout: 15000 })
}

const logoutUi = async (page) => {
  await page.evaluate(() => {
    localStorage.removeItem('myxi-user')
    localStorage.removeItem('myxi-token')
  })
}

const getAdminUsers = (request) => apiCall(request, 'GET', '/admin/users', undefined, 200)

const findUserByGameName = async (request, gameName) => {
  const users = await getAdminUsers(request)
  return (users || []).find((user) => user.gameName === gameName) || null
}

const ensureMasterRole = async (request) => {
  const users = await getAdminUsers(request)
  const masterUser =
    (users || []).find((user) => user.gameName === MASTER_USER) ||
    (users || []).find((user) => user.role === 'master_admin')
  if (!masterUser) return
  await apiCall(
    request,
    'PATCH',
    `/admin/users/${masterUser.id}`,
    {
      actorUserId: MASTER_USER,
      role: 'master_admin',
      status: 'active',
    },
    200,
  )
}

const deleteUserIfPresent = async (request, gameName) => {
  const existing = await findUserByGameName(request, gameName)
  if (!existing) return
  await apiCall(
    request,
    'DELETE',
    `/admin/users/${existing.id}`,
    { actorUserId: MASTER_USER },
    200,
  )
}

const createContest = async ({
  request,
  tournamentId,
  name,
  teams = 80,
  createdBy = MASTER_USER,
  matchIds,
}) => {
  let resolvedMatchIds = Array.isArray(matchIds) ? matchIds : []
  if (!resolvedMatchIds.length) {
    const options = await apiCall(
      request,
      'GET',
      `/admin/contest-match-options?tournamentId=${tournamentId}`,
      undefined,
      200,
    )
    resolvedMatchIds = (options || [])
      .filter((row) => row?.selectable)
      .slice(0, 3)
      .map((row) => row.id)
  }
  return apiCall(
    request,
    'POST',
    '/admin/contests',
    {
      name,
      tournamentId,
      game: 'Fantasy',
      teams,
      status: 'Open',
      joined: true,
      createdBy,
      matchIds: resolvedMatchIds,
    },
    201,
  )
}

const saveSelection = async ({ request, contestId, userId, matchId = 'm1' }) => {
  let resolvedMatchId = matchId
  if (!resolvedMatchId || resolvedMatchId === 'm1') {
    const matches = await apiCall(
      request,
      'GET',
      `/contests/${contestId}/matches?userId=${encodeURIComponent(userId)}`,
      undefined,
      200,
    )
    resolvedMatchId = (matches || [])[0]?.id || 'm1'
  }
  const pool = await apiCall(
    request,
    'GET',
    `/team-pool?contestId=${contestId}&matchId=${resolvedMatchId}&userId=${userId}`,
    undefined,
    200,
  )
  const teamA = pool?.teams?.teamA?.players || []
  const teamB = pool?.teams?.teamB?.players || []
  const players = [...teamA, ...teamB]
  const playingXi = players.slice(0, 11).map((player) => player.id)
  const backups = players.slice(11, 14).map((player) => player.id)
  if (playingXi.length !== 11) {
    throw new Error(`Expected 11 players in pool for ${contestId}/${userId}`)
  }
  await apiCall(
    request,
    'POST',
    '/team-selection/save',
    {
      contestId,
      matchId: resolvedMatchId,
      userId,
      playingXi,
      backups,
    },
    200,
  )
}

const openAdminUsersTab = async (page) => {
  await page.goto('/home')
  await page.getByRole('button', { name: 'Admin Manager' }).click()
  await page.getByRole('tab', { name: /Users \(/ }).click()
  await expect(page.locator('.catalog-table tbody tr').first()).toBeVisible()
}

const setRoleInUsersTable = async (page, displayName, roleValue) => {
  const row = page.locator('.catalog-table tbody tr', { hasText: displayName }).first()
  await expect(row).toBeVisible()
  await row.locator('select').selectOption(roleValue)
}

const expectUserVisibleInLeaderboard = async ({ request, contestId, userName }) => {
  const board = await apiCall(
    request,
    'GET',
    `/contests/${contestId}/leaderboard`,
    undefined,
    200,
  )
  expect((board.rows || []).some((row) => row.userId === userName)).toBe(true)
}

const chooseCompletedMatch = async (page) => {
  const completedRows = page.locator('.match-table tbody tr', { hasText: 'Completed' })
  if ((await completedRows.count()) > 0) {
    await completedRows.first().click()
    return
  }
  await page.locator('.match-table tbody tr').first().click()
}

const expectUserInParticipantsAndTeam = async ({ page, tournamentId, contestId, userName }) => {
  await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)
  await expect(page.locator('.match-table tbody tr').first()).toBeVisible()
  await chooseCompletedMatch(page)

  const row = page.locator('.participants-table tbody tr', { hasText: userName }).first()
  await expect(row).toBeVisible({ timeout: 15000 })
  const iconButtons = row.locator('button.icon-eye-btn')
  if ((await iconButtons.count()) > 0) {
    const viewBtn = iconButtons.first()
    const disabled = await viewBtn.getAttribute('disabled')
    if (disabled != null) return
    await viewBtn.click()
    await expect(page.locator('.team-preview-drawer.open')).toBeVisible()
    await page.locator('.team-preview-head').getByRole('button', { name: 'Close' }).click()
    await expect(page.locator('.team-preview-drawer.open')).toHaveCount(0)
  }
}

test.describe('Core bot user role and contest flows', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(240000)

  test('covers setup, joins, leaderboard/participants, role permissions, score updates, and cleanup', async ({
    page,
    request,
  }) => {
    const createdContestIds = []
    const contestMeta = []

    try {
      for (const bot of BOT_USERS) {
        await deleteUserIfPresent(request, bot.gameName)
      }

      for (const bot of BOT_USERS) {
        await apiCall(request, 'POST', '/auth/register', bot, 201)
        const created = await findUserByGameName(request, bot.gameName)
        await apiCall(
          request,
          'PATCH',
          `/admin/users/${created.id}`,
          { actorUserId: MASTER_USER, status: 'active' },
          200,
        )
        await apiCall(
          request,
          'POST',
          '/auth/login',
          { userId: bot.gameName, password: bot.password },
          200,
        )
      }
      const tournaments = await apiCall(request, 'GET', '/tournaments', undefined, 200)
      expect((tournaments || []).length).toBeGreaterThanOrEqual(3)
      const selectedTournaments = tournaments.slice(0, 3)

      const runId = Date.now()
      for (let i = 0; i < 3; i += 1) {
        const contest = await createContest({
          request,
          tournamentId: selectedTournaments[i].id,
          name: `bot-core-${i + 1}-${runId}`,
          teams: 80,
        })
        createdContestIds.push(contest.id)
        contestMeta.push({ contestId: contest.id, tournamentId: selectedTournaments[i].id })
      }

      const [abcContest, cdeContest, efgContest] = contestMeta
      await saveSelection({ request, contestId: abcContest.contestId, userId: BOT_USERS[0].gameName })
      await saveSelection({ request, contestId: cdeContest.contestId, userId: BOT_USERS[0].gameName })

      await saveSelection({ request, contestId: cdeContest.contestId, userId: BOT_USERS[1].gameName })
      await saveSelection({ request, contestId: efgContest.contestId, userId: BOT_USERS[1].gameName })

      await saveSelection({ request, contestId: abcContest.contestId, userId: BOT_USERS[2].gameName })
      await saveSelection({ request, contestId: efgContest.contestId, userId: BOT_USERS[2].gameName })

      await ensureMasterRole(request)
      await loginUi(page, MASTER_USER)
      await openAdminUsersTab(page)

      await setRoleInUsersTable(page, BOT_USERS[0].name, 'admin')
      await setRoleInUsersTable(page, BOT_USERS[1].name, 'contest_manager')
      await setRoleInUsersTable(page, BOT_USERS[2].name, 'user')
      await page.getByRole('button', { name: /Save \(/ }).click()
      await expect(page.getByText('Roles saved')).toBeVisible()

      const botCdeAfterMasterRole = await findUserByGameName(request, BOT_USERS[1].gameName)
      expect(botCdeAfterMasterRole).toBeTruthy()
      if (!botCdeAfterMasterRole.contestManagerContestId) {
        await apiCall(
          request,
          'PATCH',
          `/admin/users/${botCdeAfterMasterRole.id}`,
          {
            actorUserId: MASTER_USER,
            role: 'contest_manager',
            contestManagerContestId: cdeContest.contestId,
          },
          200,
        )
      }

      for (const [botIndex, targetContest] of [
        [0, abcContest],
        [0, cdeContest],
        [1, cdeContest],
        [1, efgContest],
        [2, abcContest],
        [2, efgContest],
      ]) {
        await expectUserVisibleInLeaderboard({
          request,
          contestId: targetContest.contestId,
          userName: BOT_USERS[botIndex].gameName,
        })
      }

      for (const [botIndex, targetContest] of [
        [0, abcContest],
        [1, cdeContest],
        [2, efgContest],
      ]) {
        await expectUserInParticipantsAndTeam({
          page,
          tournamentId: targetContest.tournamentId,
          contestId: targetContest.contestId,
          userName: BOT_USERS[botIndex].gameName,
        })
      }

      await logoutUi(page)
      await loginUi(page, BOT_USERS[0].gameName)
      await openAdminUsersTab(page)

      const promoteAttempt = await request.fetch(
        `http://127.0.0.1:4000/admin/users/${botCdeAfterMasterRole.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: BOT_USERS[0].gameName, role: 'admin' },
        },
      )
      expect(promoteAttempt.status()).toBe(403)

      await setRoleInUsersTable(page, BOT_USERS[2].name, 'contest_manager')
      await page.getByRole('button', { name: /Save \(/ }).click()
      await expect(page.getByText('Roles saved')).toBeVisible()

      const botEfg = await findUserByGameName(request, BOT_USERS[2].gameName)
      expect(botEfg).toBeTruthy()
      await apiCall(
        request,
        'PATCH',
        `/admin/users/${botEfg.id}`,
        {
          actorUserId: BOT_USERS[0].gameName,
          contestManagerContestId: efgContest.contestId,
        },
        200,
      )

      await logoutUi(page)
      await loginUi(page, BOT_USERS[2].gameName)
      await expect(page.getByRole('button', { name: 'Score Manager' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Admin Manager' })).toHaveCount(0)

      await page.getByRole('button', { name: 'Score Manager' }).click()
      await expect(page.locator('.match-scores-section')).toBeVisible()
      const tournamentSelect = page.locator(
        '.manual-scope-row label:has-text("Tournament") select',
      )
      const matchSelect = page.locator('.manual-scope-row label:has-text("Match") select')
      await tournamentSelect.selectOption(efgContest.tournamentId)
      await expect
        .poll(async () => matchSelect.locator('option').count(), { timeout: 15000 })
        .toBeGreaterThan(1)
      const matchValue = await matchSelect.evaluate((node) => {
        const options = Array.from(node.options || [])
        const first = options.find((opt) => opt.value)
        return first ? first.value : ''
      })
      expect(matchValue).toBeTruthy()
      await matchSelect.selectOption(matchValue)
      await page.locator('.upload-head-actions').getByRole('button', { name: 'Save' }).click()
      await expect(page.locator('.success-text')).toContainText('Manual scores saved', {
        timeout: 15000,
      })

      await apiCall(
        request,
        'DELETE',
        `/admin/users/${botEfg.id}`,
        { actorUserId: MASTER_USER },
        200,
      )
      const botCde = await findUserByGameName(request, BOT_USERS[1].gameName)
      expect(botCde).toBeTruthy()
      await apiCall(
        request,
        'DELETE',
        `/admin/users/${botCde.id}`,
        { actorUserId: MASTER_USER },
        200,
      )
      const botAbc = await findUserByGameName(request, BOT_USERS[0].gameName)
      expect(botAbc).toBeTruthy()
      await apiCall(
        request,
        'DELETE',
        `/admin/users/${botAbc.id}`,
        { actorUserId: MASTER_USER },
        200,
      )

      await logoutUi(page)
      await loginUi(page, MASTER_USER)
      await openAdminUsersTab(page)
      await expect(page.locator('.catalog-table tbody tr', { hasText: BOT_USERS[0].name })).toHaveCount(0)
      await expect(page.locator('.catalog-table tbody tr', { hasText: BOT_USERS[1].name })).toHaveCount(0)
      await expect(page.locator('.catalog-table tbody tr', { hasText: BOT_USERS[2].name })).toHaveCount(0)

      await page.goto(`/tournaments/${abcContest.tournamentId}/contests/${abcContest.contestId}/leaderboard`)
      await expect(page.getByRole('button', { name: BOT_USERS[0].gameName })).toHaveCount(0)

      await page.goto(`/tournaments/${abcContest.tournamentId}/contests/${abcContest.contestId}`)
      await chooseCompletedMatch(page)
      await expect(
        page.locator('.participants-table tbody tr', { hasText: BOT_USERS[0].gameName }),
      ).toHaveCount(0)
    } finally {
      for (const bot of BOT_USERS) {
        try {
          const existing = await findUserByGameName(request, bot.gameName)
          if (!existing) continue
          await apiCall(
            request,
            'DELETE',
            `/admin/users/${existing.id}`,
            { actorUserId: MASTER_USER },
            200,
          )
        } catch {
          // best-effort cleanup
        }
      }

      for (const contestId of createdContestIds) {
        try {
          const response = await request.fetch(
            `http://127.0.0.1:4000/admin/contests/${contestId}`,
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
            },
          )
          if (![200, 404].includes(response.status())) {
            // best-effort cleanup
          }
        } catch {
          // best-effort cleanup
        }
      }
    }
  })
})
