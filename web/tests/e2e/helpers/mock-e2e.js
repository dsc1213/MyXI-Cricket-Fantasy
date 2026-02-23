import { expect } from '@playwright/test'

export const PASSWORD = 'demo123'

export const apiCall = async (request, method, path, body, expectedStatus = 200) => {
  let lastError = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await request.fetch(`http://127.0.0.1:4000${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
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

export const loginUi = async (page, userId, password = PASSWORD) => {
  await page.context().clearCookies()
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.evaluate(() => {
    window.localStorage.removeItem('myxi-user')
    window.localStorage.removeItem('myxi-token')
  })
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.getByLabel('User ID or Email').fill(userId)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/home/, { timeout: 15000 })
}

export const logoutUi = async (page) => {
  try {
    await page.goto('/login')
  } catch {
    // ignore
  }
  await page.evaluate(() => {
    window.localStorage.removeItem('myxi-user')
    window.localStorage.removeItem('myxi-token')
  })
}

export const openAdminUsersTab = async (page) => {
  await page.goto('/home')
  await page.getByRole('button', { name: 'Admin Manager' }).click()
  await page.getByRole('tab', { name: /Users \(/ }).click()
  await expect(page.locator('.catalog-table tbody tr').first()).toBeVisible()
}

export const setRoleInUsersTable = async (page, displayName, roleValue) => {
  const row = page.locator('.catalog-table tbody tr', { hasText: displayName }).first()
  await expect(row).toBeVisible()
  await row.locator('select').selectOption(roleValue)
}

export const saveRolesFromUsersTab = async (page) => {
  await page.getByRole('button', { name: /Save \(/ }).click()
  await expect(page.getByText('Roles saved')).toBeVisible()
}

export const getAdminUsers = (request) => apiCall(request, 'GET', '/admin/users', undefined, 200)

export const findUserByGameName = async (request, gameName) => {
  const users = await getAdminUsers(request)
  return (users || []).find((user) => user.gameName === gameName) || null
}

export const getMasterActorUserId = async (request) => {
  const users = await getAdminUsers(request)
  const masterByGameName = (users || []).find((user) => user.gameName === 'master')
  if (masterByGameName) return masterByGameName.gameName
  const anyMaster = (users || []).find((user) => user.role === 'master_admin')
  return anyMaster ? String(anyMaster.id) : 'master'
}

export const deleteUserIfPresent = async (request, gameName) => {
  const existing = await findUserByGameName(request, gameName)
  if (!existing) return
  const actorUserId = await getMasterActorUserId(request)
  await apiCall(request, 'DELETE', `/admin/users/${existing.id}`, { actorUserId }, 200)
}

export const createBotUsers = (tag) => [
  {
    name: 'abc',
    gameName: `mocke2ebot-abc-${tag}`,
    email: `mocke2ebot-abc-${tag}@myxi.local`,
    password: PASSWORD,
  },
  {
    name: 'cde',
    gameName: `mocke2ebot-cde-${tag}`,
    email: `mocke2ebot-cde-${tag}@myxi.local`,
    password: PASSWORD,
  },
  {
    name: 'efg',
    gameName: `mocke2ebot-efg-${tag}`,
    email: `mocke2ebot-efg-${tag}@myxi.local`,
    password: PASSWORD,
  },
]

export const registerAndActivateBot = async (request, botUser) => {
  await apiCall(request, 'POST', '/auth/register', botUser, 201)
  const actorUserId = await getMasterActorUserId(request)
  const created = await findUserByGameName(request, botUser.gameName)
  if (!created) throw new Error(`Failed to find registered user ${botUser.gameName}`)
  await apiCall(
    request,
    'PATCH',
    `/admin/users/${created.id}`,
    { actorUserId, status: 'active' },
    200,
  )
  await apiCall(request, 'POST', '/auth/login', { userId: botUser.gameName, password: botUser.password }, 200)
}

export const createContest = async ({
  request,
  tournamentId,
  name,
  teams = 80,
  createdBy = 'master',
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

export const deleteContestIfPresent = async (request, contestId, actorUserId = 'master') => {
  if (!contestId) return
  try {
    await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      data: actorUserId ? { actorUserId } : {},
    })
  } catch {
    // best effort
  }
}

export const saveSelection = async ({ request, contestId, userId, matchId = 'm1' }) => {
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

export const patchUserByGameName = async (request, targetGameName, payload = {}, actorUserId) => {
  const target = await findUserByGameName(request, targetGameName)
  if (!target) throw new Error(`User not found: ${targetGameName}`)
  return apiCall(
    request,
    'PATCH',
    `/admin/users/${target.id}`,
    {
      ...payload,
      actorUserId,
    },
    200,
  )
}

export const expectUserInLeaderboard = async ({ page, tournamentId, contestId, gameName }) => {
  await page.goto(`/tournaments/${tournamentId}/contests/${contestId}/leaderboard`)
  await expect(
    page.locator('.leaderboard-table tbody tr', { hasText: gameName }).first(),
  ).toBeVisible({ timeout: 15000 })
}

export const chooseCompletedMatch = async (page) => {
  const completedRows = page.locator('.match-table tbody tr', { hasText: 'Completed' })
  if ((await completedRows.count()) > 0) {
    await completedRows.first().click()
    return
  }
  await page.locator('.match-table tbody tr').first().click()
}

export const expectUserInParticipants = async ({
  page,
  tournamentId,
  contestId,
  gameName,
  openTeam = false,
}) => {
  await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)
  await expect(page.locator('.match-table tbody tr').first()).toBeVisible()
  await chooseCompletedMatch(page)
  const row = page.locator('.participants-table tbody tr', { hasText: gameName }).first()
  await expect(row).toBeVisible({ timeout: 15000 })

  if (!openTeam) return
  await row.getByRole('button', { name: `View ${gameName} team` }).click()
  await expect(page.locator('.team-preview-drawer.open')).toBeVisible()
  await expect(page.getByRole('heading', { name: `${gameName} XI` })).toBeVisible()
  await page.locator('.team-preview-head').getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('.team-preview-drawer.open')).toHaveCount(0)
}
