import { expect, request as playwrightRequest, test } from '@playwright/test'
import { apiCall } from './helpers/mock-e2e.js'

const E2E_API_BASE = process.env.PW_E2E_API_BASE_URL || 'http://127.0.0.1:4000'

const MASTER_LOGIN =
  process.env.PW_DB_MASTER_LOGIN || process.env.PW_E2E_MASTER_LOGIN || ''
const MASTER_PASSWORD =
  process.env.PW_DB_MASTER_PASSWORD || process.env.PW_E2E_MASTER_PASSWORD || ''
const KEEP_DB_SMOKE_DATA =
  (process.env.PW_KEEP_DB_SMOKE_DATA || '').toString().trim().toLowerCase() === 'true'

const requireDbMasterCreds = () => {
  if (!MASTER_LOGIN || !MASTER_PASSWORD) {
    throw new Error(
      'DB smoke tests require PW_DB_MASTER_LOGIN and PW_DB_MASTER_PASSWORD (or PW_E2E_MASTER_LOGIN / PW_E2E_MASTER_PASSWORD).',
    )
  }
}

const normalizeTournamentId = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const buildTournamentSquad = (teamCode, teamName, countryLabel) => {
  const lowerCountry = countryLabel.toLowerCase()
  return [
    { name: `${teamName} Keeper`, country: lowerCountry, role: 'WK' },
    { name: `${teamName} Batter 1`, country: lowerCountry, role: 'BAT' },
    { name: `${teamName} Batter 2`, country: lowerCountry, role: 'BAT' },
    { name: `${teamName} Batter 3`, country: lowerCountry, role: 'BAT' },
    { name: `${teamName} Batter 4`, country: lowerCountry, role: 'BAT' },
    { name: `${teamName} Allrounder 1`, country: lowerCountry, role: 'AR' },
    { name: `${teamName} Allrounder 2`, country: lowerCountry, role: 'AR' },
    { name: `${teamName} Bowler 1`, country: lowerCountry, role: 'BOWL' },
    { name: `${teamName} Bowler 2`, country: lowerCountry, role: 'BOWL' },
    { name: `${teamName} Bowler 3`, country: lowerCountry, role: 'BOWL' },
    { name: `${teamName} Bowler 4`, country: lowerCountry, role: 'BOWL' },
  ].map((player, index) => ({
    ...player,
    imageUrl: '',
    active: true,
    sourceKey: `${teamCode.toLowerCase()}-${index + 1}-${normalizeTournamentId(player.name)}`,
  }))
}

const buildValidPlayingXi = (teamAPlayers = [], teamBPlayers = []) => {
  const allPlayers = [...teamAPlayers, ...teamBPlayers]
  const teamAIds = new Set(teamAPlayers.map((player) => player.id))
  const selected = []
  const selectedIds = new Set()
  let teamACount = 0
  let teamBCount = 0

  const tryAdd = (player) => {
    if (!player || selectedIds.has(player.id)) return false
    const isTeamA = teamAIds.has(player.id)
    if (isTeamA && teamACount >= 8) return false
    if (!isTeamA && teamBCount >= 8) return false
    selected.push(player)
    selectedIds.add(player.id)
    if (isTeamA) teamACount += 1
    else teamBCount += 1
    return true
  }

  tryAdd(allPlayers.find((player) => player.role === 'WK'))
  tryAdd(allPlayers.find((player) => player.role === 'BAT'))
  tryAdd(allPlayers.find((player) => player.role === 'BOWL'))

  for (const player of allPlayers) {
    if (selected.length >= 11) break
    tryAdd(player)
  }

  if (selected.length !== 11) {
    throw new Error(
      `Expected a valid XI, found only ${selected.length} selectable players`,
    )
  }

  return selected
}

const trackedSmokeArtifacts = {
  userIds: new Set(),
  playerIds: new Set(),
  contestIds: new Set(),
  tournamentIds: new Set(),
  tournamentSourceKeys: new Set(),
}

const trackSmokeArtifact = (bucket, value) => {
  if (!value && value !== 0) return
  trackedSmokeArtifacts[bucket]?.add(String(value))
}

const resolveTournamentIdBySourceKey = async (requestContext, sourceKey) => {
  if (!sourceKey) return null
  const catalog = await apiCall(
    requestContext,
    'GET',
    '/admin/tournaments/catalog',
    undefined,
    200,
  )
  const tournament = (catalog || []).find(
    (row) => String(row?.sourceKey) === String(sourceKey),
  )
  return tournament?.id || null
}

const cleanupTrackedSmokeArtifacts = async () => {
  if (KEEP_DB_SMOKE_DATA) return
  if (!MASTER_LOGIN || !MASTER_PASSWORD) return

  let cleanupRequest = null

  try {
    const anonymousRequest = await playwrightRequest.newContext({
      baseURL: E2E_API_BASE,
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    })
    const authState = await apiCall(
      anonymousRequest,
      'POST',
      '/auth/login',
      { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
      200,
    )
    await anonymousRequest.dispose()

    const actorUserId =
      authState?.user?.userId ||
      authState?.user?.gameName ||
      authState?.user?.email ||
      MASTER_LOGIN

    cleanupRequest = await playwrightRequest.newContext({
      baseURL: E2E_API_BASE,
      extraHTTPHeaders: {
        Authorization: `Bearer ${authState.token}`,
        'Content-Type': 'application/json',
      },
    })

    for (const sourceKey of trackedSmokeArtifacts.tournamentSourceKeys) {
      try {
        const resolvedId = await resolveTournamentIdBySourceKey(cleanupRequest, sourceKey)
        if (resolvedId) trackedSmokeArtifacts.tournamentIds.add(String(resolvedId))
      } catch {
        // best effort resolution
      }
    }

    for (const contestId of trackedSmokeArtifacts.contestIds) {
      try {
        await cleanupRequest.fetch(`${E2E_API_BASE}/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId },
        })
      } catch {
        // best effort cleanup
      }
    }

    for (const playerId of trackedSmokeArtifacts.playerIds) {
      try {
        await cleanupRequest.fetch(`${E2E_API_BASE}/admin/players/${playerId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId },
        })
      } catch {
        // best effort cleanup
      }
    }

    for (const tournamentId of trackedSmokeArtifacts.tournamentIds) {
      try {
        await cleanupRequest.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId },
        })
      } catch {
        // best effort cleanup
      }
    }

    for (const userId of trackedSmokeArtifacts.userIds) {
      try {
        await cleanupRequest.fetch(`${E2E_API_BASE}/admin/users/${userId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId },
        })
      } catch {
        // best effort cleanup
      }
    }
  } finally {
    await cleanupRequest?.dispose()
  }
}

test.describe('20) DB smoke flows', () => {
  test.setTimeout(180000)

  test.afterAll(async () => {
    await cleanupTrackedSmokeArtifacts()
  })

  test('db pending approvals lists and approves registered pending users', async ({
    page,
  }) => {
    requireDbMasterCreds()
    const tag = Date.now()
    const pendingUser = {
      name: `DB Pending ${tag}`,
      gameName: `db-pending-${tag}`,
      email: `db-pending-${tag}@myxi.local`,
      phone: '+1-555-4455',
      location: 'Dallas, USA',
      password: 'demo123',
      securityAnswers: ['db-school', 'db-player', 'db-city'],
    }
    let authedRequest = null
    let createdUserId = null

    try {
      const anonymousRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
        },
      })
      const authState = await apiCall(
        anonymousRequest,
        'POST',
        '/auth/login',
        { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
        200,
      )
      await anonymousRequest.dispose()

      authedRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
      })

      await authedRequest.fetch(`${E2E_API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: pendingUser,
      })

      const adminUsers = await apiCall(
        authedRequest,
        'GET',
        `/admin/users?search=${encodeURIComponent(pendingUser.gameName)}`,
        undefined,
        200,
      )
      const createdUser = (adminUsers || []).find(
        (row) =>
          row.gameName === pendingUser.gameName || row.userId === pendingUser.gameName,
      )
      expect(createdUser).toBeTruthy()
      expect(createdUser.status).toBe('pending')
      createdUserId = createdUser.id
      trackSmokeArtifact('userIds', createdUserId)

      await page.goto('/login')
      await page.evaluate((session) => {
        window.localStorage.setItem('myxi-user', JSON.stringify(session))
        if (session?.token) {
          window.localStorage.setItem('myxi-token', session.token)
        }
      }, authState)
      await page.goto('/home')
      await page.getByRole('button', { name: 'Pending Approvals' }).click()

      const pendingTable = page.locator('.pending-approvals-table')
      await expect(pendingTable).toBeVisible()
      const row = pendingTable
        .locator('tbody tr', { hasText: pendingUser.gameName })
        .first()
      await expect(row).toBeVisible()
      await expect(row).toContainText(pendingUser.email)
      await expect(row).toContainText(pendingUser.phone)
      await expect(row).toContainText(pendingUser.location)

      await row.getByRole('button', { name: 'Approve' }).click()
      await expect(page.getByText('User approved')).toBeVisible()
      await expect(
        pendingTable.locator('tbody tr', { hasText: pendingUser.gameName }),
      ).toHaveCount(0)

      const approvedLogin = await authedRequest.fetch(`${E2E_API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { userId: pendingUser.gameName, password: pendingUser.password },
      })
      expect(approvedLogin.status()).toBe(200)
    } finally {
      if (!KEEP_DB_SMOKE_DATA && authedRequest && createdUserId) {
        try {
          await authedRequest.fetch(`${E2E_API_BASE}/admin/users/${createdUserId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            data: { actorUserId: MASTER_LOGIN },
          })
        } catch {
          // best effort cleanup
        }
      }
      if (authedRequest) {
        await authedRequest.dispose()
      }
    }
  })

  test('db squad manager import resolves string tournament source keys', async () => {
    requireDbMasterCreds()
    const tag = Date.now()
    const tournamentName = `DB Squad Import ${tag}`
    const tournamentId = normalizeTournamentId(`${tournamentName}-2026`)
    let authState = null
    let cleanupRequest = null

    try {
      const anonymousRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
        },
      })
      authState = await apiCall(
        anonymousRequest,
        'POST',
        '/auth/login',
        { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
        200,
      )
      await anonymousRequest.dispose()

      cleanupRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
      })

      await apiCall(
        cleanupRequest,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: MASTER_LOGIN,
          tournamentId,
          name: tournamentName,
          season: '2026',
          source: 'json',
          tournamentType: 'league',
          country: 'india',
          league: 'IPL',
          selectedTeams: ['CSK'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'CSK',
              away: 'MI',
              startAt: '2099-03-10T14:00:00.000Z',
              timezone: 'Asia/Kolkata',
              venue: 'Chennai',
            },
          ],
        },
        201,
      )
      trackSmokeArtifact('tournamentSourceKeys', tournamentId)

      await apiCall(
        cleanupRequest,
        'POST',
        '/admin/team-squads',
        {
          actorUserId: MASTER_LOGIN,
          tournamentId,
          tournament: tournamentName,
          country: 'india',
          league: 'IPL',
          teamSquads: [
            {
              teamCode: 'CSK',
              teamName: 'Chennai Super Kings',
              squad: [
                {
                  id: `csk-wk-${tag}`,
                  name: `CSK Keeper ${tag}`,
                  country: 'india',
                  role: 'WK',
                },
              ],
            },
          ],
        },
        201,
      )

      const squads = await apiCall(
        cleanupRequest,
        'GET',
        '/admin/team-squads?teamCode=CSK&tournamentId=' +
          encodeURIComponent(tournamentId),
        undefined,
        200,
      )
      expect(Array.isArray(squads)).toBe(true)
      expect(JSON.stringify(squads)).toContain(`CSK Keeper ${tag}`)
    } finally {
      if (!KEEP_DB_SMOKE_DATA && cleanupRequest) {
        try {
          await cleanupRequest.fetch(
            `${E2E_API_BASE}/admin/tournaments/${tournamentId}`,
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              data: { actorUserId: MASTER_LOGIN },
            },
          )
        } catch {
          // best effort cleanup
        }
        await cleanupRequest.dispose()
      }
    }
  })

  test('db player manager imports uuid-like external player ids', async ({ page }) => {
    const tag = Date.now()
    const playerId = `02e239d1-c27b-48f4-af45-${String(tag).slice(-12)}`
    const playerName = `DB UUID Player ${tag}`
    let authState = null

    try {
      const anonymousRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
        },
      })
      authState = await apiCall(
        anonymousRequest,
        'POST',
        '/auth/login',
        { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
        200,
      )
      await anonymousRequest.dispose()

      await page.goto('/login')
      await page.evaluate((session) => {
        window.localStorage.setItem('myxi-user', JSON.stringify(session))
        if (session?.token) {
          window.localStorage.setItem('myxi-token', session.token)
        }
      }, authState)
      await page.goto('/home?panel=players')

      await page.getByRole('button', { name: 'JSON import' }).click()
      const modal = page.locator('.player-manager-import-modal')
      await expect(modal).toBeVisible()
      await modal.locator('textarea').fill(
        JSON.stringify(
          {
            players: [
              {
                id: playerId,
                name: playerName,
                nationality: 'india',
                role: 'BAT',
                player_img: 'https://h.cricapi.com/img/icon512.png',
                base_price: 25,
              },
            ],
          },
          null,
          2,
        ),
      )
      await modal.getByRole('button', { name: 'Import players' }).click()
      await expect(page.getByText('Imported 1 players')).toBeVisible()
      await expect(page.locator('.catalog-table tbody')).toContainText(playerName)
    } finally {
      if (!KEEP_DB_SMOKE_DATA && authState?.token) {
        const cleanupRequest = await playwrightRequest.newContext({
          baseURL: E2E_API_BASE,
          extraHTTPHeaders: {
            Authorization: `Bearer ${authState.token}`,
            'Content-Type': 'application/json',
          },
        })
        try {
          const players = await apiCall(cleanupRequest, 'GET', '/players', undefined, 200)
          const imported = (players || []).find((row) => {
            const name = (
              row.displayName ||
              row.name ||
              [row.firstName, row.lastName].filter(Boolean).join(' ')
            )
              .toString()
              .trim()
            return name === playerName
          })
          if (imported?.id) {
            trackSmokeArtifact('playerIds', imported.id)
            await cleanupRequest.fetch(`${E2E_API_BASE}/admin/players/${imported.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              data: { actorUserId: MASTER_LOGIN },
            })
          }
        } catch {
          // best effort cleanup
        }
        await cleanupRequest.dispose()
      }
    }
  })

  test('db player manager + squad manager persist tournament player links after refresh', async ({
    page,
  }) => {
    const tag = Date.now()
    const tournamentName = `DB Smoke IPL ${tag}`
    const tournamentId = normalizeTournamentId(`${tournamentName}-2026`)
    const playerName = `DB Smoke Player ${tag}`
    const teamCode = `DB${String(tag).slice(-3)}`
    const teamName = `DB Smoke Team ${tag}`
    let createdTournamentRowId = null
    let createdPlayerId = null
    let actorUserId = MASTER_LOGIN
    let authedRequest = null

    try {
      const anonymousRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
        },
      })
      const authState = await apiCall(
        anonymousRequest,
        'POST',
        '/auth/login',
        { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
        200,
      )
      await anonymousRequest.dispose()

      actorUserId =
        authState?.user?.userId ||
        authState?.user?.gameName ||
        authState?.user?.email ||
        authState?.userId ||
        authState?.gameName ||
        authState?.email ||
        MASTER_LOGIN
      authedRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
      })

      await page.goto('/login')
      await page.evaluate((session) => {
        window.localStorage.setItem('myxi-user', JSON.stringify(session))
        if (session?.token) {
          window.localStorage.setItem('myxi-token', session.token)
        }
      }, authState)
      await page.goto('/home?panel=players')
      await expect(page).toHaveURL(/\/home/)

      const createdTournament = await apiCall(
        authedRequest,
        'POST',
        '/admin/tournaments',
        {
          actorUserId,
          tournamentId,
          name: tournamentName,
          season: '2026',
          source: 'manual',
          tournamentType: 'league',
          country: 'india',
          league: 'IPL',
          selectedTeams: ['MI', 'CSK'],
          matches: [
            {
              matchNo: 1,
              id: 'm1',
              home: 'MI',
              away: 'CSK',
              date: '2099-01-10',
              startAt: '2099-01-10T14:00:00.000Z',
              venue: 'Mumbai',
            },
          ],
        },
        201,
      )
      createdTournamentRowId = createdTournament?.tournament?.id || null
      expect(createdTournamentRowId).toBeTruthy()
      trackSmokeArtifact('tournamentIds', createdTournamentRowId)
      trackSmokeArtifact('tournamentSourceKeys', tournamentId)

      await page.getByRole('button', { name: 'Add player' }).click()
      const playerModal = page.locator('.player-manager-create-modal')
      await expect(playerModal).toBeVisible()
      await playerModal.getByLabel('Name').fill(playerName)
      await playerModal.getByLabel('Country').selectOption('india')
      await playerModal.getByLabel('Role').selectOption('BAT')
      await playerModal.getByRole('button', { name: 'Add player' }).click()
      await expect(page.getByText('Player saved')).toBeVisible()

      const players = await apiCall(authedRequest, 'GET', '/players', undefined, 200)
      const createdPlayer = (players || []).find((row) => {
        const name = (
          row.displayName ||
          row.name ||
          [row.firstName, row.lastName].filter(Boolean).join(' ')
        )
          .toString()
          .trim()
        return name === playerName
      })
      expect(createdPlayer).toBeTruthy()
      createdPlayerId = createdPlayer?.id
      trackSmokeArtifact('playerIds', createdPlayerId)
      await page.getByPlaceholder('Filter players').fill(playerName)

      await page.goto('/home?panel=squads')
      const scopeSelects = page.locator('.manual-scope-row').first().locator('select')
      await scopeSelects.nth(0).selectOption('tournament')
      await scopeSelects.nth(1).selectOption(String(createdTournamentRowId))
      await scopeSelects.nth(2).selectOption('__new__')
      await page.getByLabel('Team code').fill(teamCode)
      await page.getByLabel('Team name').fill(teamName)

      await page.getByRole('button', { name: 'Add player' }).click()
      const squadModal = page.locator('.squad-player-picker-modal')
      await expect(squadModal).toBeVisible()
      await squadModal.locator('select').first().selectOption('india')
      await squadModal.getByPlaceholder('Search player catalog').fill(playerName)
      const pickerRow = squadModal
        .locator('.squad-player-picker-row', { hasText: playerName })
        .first()
      await expect(pickerRow).toBeVisible()
      await pickerRow.locator('input[type="checkbox"]').check()
      await squadModal.getByRole('button', { name: 'Add selected players' }).click()

      await expect(
        page.locator('.catalog-table tbody input[type="text"]').first(),
      ).toHaveValue(playerName)

      await page.getByRole('button', { name: 'Save squad' }).click()
      await expect(page.getByText('Squad saved')).toBeVisible()

      const savedRows = await apiCall(
        authedRequest,
        'GET',
        `/admin/team-squads?teamCode=${encodeURIComponent(teamCode)}&tournamentId=${encodeURIComponent(String(createdTournamentRowId))}`,
        undefined,
        200,
      )
      expect(Array.isArray(savedRows)).toBe(true)
      expect(savedRows[0]?.teamCode).toBe(teamCode)
      expect(String(savedRows[0]?.tournamentId)).toBe(String(createdTournamentRowId))
      expect(
        (savedRows[0]?.squad || []).some(
          (row) => String(row.id) === String(createdPlayerId),
        ),
      ).toBe(true)

      await page.reload()
      await expect(page).toHaveURL(/panel=squads/)
      const reloadedScopeSelects = page
        .locator('.manual-scope-row')
        .first()
        .locator('select')
      await reloadedScopeSelects.nth(0).selectOption('tournament')
      await reloadedScopeSelects.nth(1).selectOption(String(createdTournamentRowId))
      await expect(
        reloadedScopeSelects.nth(2).locator(`option[value="${teamCode}"]`),
      ).toHaveCount(1)
      await reloadedScopeSelects.nth(2).selectOption(teamCode)
      await expect(
        page.locator('.catalog-table tbody input[type="text"]').first(),
      ).toHaveValue(playerName)

      const linkedRows = await apiCall(
        authedRequest,
        'GET',
        `/admin/team-squads?teamCode=${encodeURIComponent(teamCode)}&tournamentId=${encodeURIComponent(String(createdTournamentRowId))}`,
        undefined,
        200,
      )
      expect(Array.isArray(linkedRows)).toBe(true)
      expect(linkedRows[0]?.teamCode).toBe(teamCode)
      expect(String(linkedRows[0]?.tournamentId)).toBe(String(createdTournamentRowId))
      expect(
        (linkedRows[0]?.squad || []).some(
          (row) => String(row.id) === String(createdPlayerId),
        ),
      ).toBe(true)
    } finally {
      if (KEEP_DB_SMOKE_DATA) {
        await authedRequest?.dispose()
        return
      }
      if (createdPlayerId) {
        try {
          await authedRequest?.fetch(`/admin/players/${createdPlayerId}`, {
            method: 'DELETE',
            data: { actorUserId },
          })
        } catch {
          // best effort cleanup
        }
      }
      try {
        await authedRequest?.fetch(`/admin/tournaments/${tournamentId}`, {
          method: 'DELETE',
          data: { actorUserId },
        })
      } catch {
        // best effort cleanup
      }
      await authedRequest?.dispose()
    }
  })

  test('db tournament enable + playing xi + score upload updates fantasy and auction leaderboards', async ({
    page,
  }) => {
    const tag = Date.now()
    const tournamentName = `DB Flow IPL ${tag}`
    const tournamentSourceId = normalizeTournamentId(`${tournamentName}-2026`)
    const fantasyContestName = `DB Fantasy ${tag}`
    const auctionContestName = `DB Auction ${tag}`
    const teamASquad = buildTournamentSquad('MI', 'Mumbai', 'India')
    const teamBSquad = buildTournamentSquad('CSK', 'Chennai', 'India')
    let actorUserId = MASTER_LOGIN
    let actorNumericUserId = null
    let createdTournamentRowId = null
    let fantasyContestId = null
    let auctionContestId = null
    let createdPlayerIds = []
    let importedAuctionUserId = ''
    let authedRequest = null

    try {
      const anonymousRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
        },
      })
      const authState = await apiCall(
        anonymousRequest,
        'POST',
        '/auth/login',
        { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
        200,
      )
      await anonymousRequest.dispose()

      actorUserId =
        authState?.user?.userId ||
        authState?.user?.gameName ||
        authState?.user?.email ||
        authState?.userId ||
        MASTER_LOGIN
      actorNumericUserId = Number(authState?.user?.id || 0) || null

      authedRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
      })

      await page.goto('/login')
      await page.evaluate((session) => {
        window.localStorage.setItem('myxi-user', JSON.stringify(session))
        if (session?.token) window.localStorage.setItem('myxi-token', session.token)
      }, authState)

      const tournamentCreate = await apiCall(
        authedRequest,
        'POST',
        '/admin/tournaments',
        {
          actorUserId,
          tournamentId: tournamentSourceId,
          name: tournamentName,
          season: '2026',
          source: 'manual',
          tournamentType: 'league',
          country: 'india',
          league: 'IPL',
          selectedTeams: ['MI', 'CSK'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'MI',
              away: 'CSK',
              date: '2099-03-10',
              startAt: '2099-03-10T14:00:00.000Z',
              venue: 'Mumbai',
            },
          ],
        },
        201,
      )
      createdTournamentRowId = tournamentCreate?.tournament?.id || null
      expect(createdTournamentRowId).toBeTruthy()
      trackSmokeArtifact('tournamentIds', createdTournamentRowId)
      trackSmokeArtifact('tournamentSourceKeys', tournamentSourceId)

      await apiCall(
        authedRequest,
        'POST',
        '/admin/team-squads',
        {
          actorUserId,
          teamCode: 'MI',
          teamName: 'Mumbai',
          tournamentType: 'tournament',
          tournamentId: createdTournamentRowId,
          tournament: tournamentName,
          country: 'india',
          league: 'IPL',
          squad: teamASquad,
          source: 'manual',
        },
        201,
      )
      await apiCall(
        authedRequest,
        'POST',
        '/admin/team-squads',
        {
          actorUserId,
          teamCode: 'CSK',
          teamName: 'Chennai',
          tournamentType: 'tournament',
          tournamentId: createdTournamentRowId,
          tournament: tournamentName,
          country: 'india',
          league: 'IPL',
          squad: teamBSquad,
          source: 'manual',
        },
        201,
      )

      const allPlayers = await apiCall(authedRequest, 'GET', '/players', undefined, 200)
      createdPlayerIds = (allPlayers || [])
        .filter((row) => {
          const name = (
            row.displayName ||
            row.name ||
            [row.firstName, row.lastName].filter(Boolean).join(' ')
          )
            .toString()
            .trim()
          return [...teamASquad, ...teamBSquad].some((item) => item.name === name)
        })
        .map((row) => row.id)
      createdPlayerIds.forEach((playerId) => trackSmokeArtifact('playerIds', playerId))

      await apiCall(
        authedRequest,
        'POST',
        '/admin/tournaments/enable',
        { actorUserId, ids: [createdTournamentRowId] },
        200,
      )

      const matchOptions = await apiCall(
        authedRequest,
        'GET',
        `/admin/contest-match-options?tournamentId=${createdTournamentRowId}`,
        undefined,
        200,
      )
      const matchId = String(matchOptions?.[0]?.id || '')
      expect(matchId).toBeTruthy()

      const createdFantasyContest = await apiCall(
        authedRequest,
        'POST',
        '/admin/contests',
        {
          actorUserId,
          tournamentId: createdTournamentRowId,
          name: fantasyContestName,
          game: 'Fantasy',
          teams: 20,
          status: 'Open',
          joined: false,
          createdBy: actorUserId,
          matchIds: [matchId],
        },
        201,
      )
      fantasyContestId =
        createdFantasyContest?.id || createdFantasyContest?.contest?.id || null
      expect(fantasyContestId).toBeTruthy()
      trackSmokeArtifact('contestIds', fantasyContestId)
      const tournamentCatalog = await apiCall(
        authedRequest,
        'GET',
        '/admin/tournaments/catalog',
        undefined,
        200,
      )
      const enabledTournament = (tournamentCatalog || []).find(
        (row) => String(row.id) === String(createdTournamentRowId),
      )
      expect(Boolean(enabledTournament?.enabled)).toBe(true)

      const importedAuctionContest = await apiCall(
        authedRequest,
        'POST',
        '/admin/auctions/import',
        {
          actorUserId,
          tournamentId: createdTournamentRowId,
          contestName: auctionContestName,
          participants: [
            {
              userId: `auction-db-${tag}`,
              gameName: `auction-db-${tag}`,
              name: `Auction DB ${tag}`,
              roster: [teamASquad[1].name, teamBSquad[7].name, teamASquad[5].name],
            },
          ],
        },
        201,
      )
      auctionContestId = importedAuctionContest?.contest?.id || null
      expect(auctionContestId).toBeTruthy()
      trackSmokeArtifact('contestIds', auctionContestId)
      importedAuctionUserId = `auction-db-${tag}`

      await apiCall(
        authedRequest,
        'POST',
        `/contests/${fantasyContestId}/join`,
        { userId: actorNumericUserId },
        200,
      )

      await apiCall(
        authedRequest,
        'POST',
        '/admin/match-lineups/upsert',
        {
          tournamentId: createdTournamentRowId,
          matchId,
          updatedBy: actorUserId,
          source: 'manual-xi',
          lineups: {
            MI: {
              squad: teamASquad.map((item) => item.name),
              playingXI: teamASquad.map((item) => item.name),
              bench: [],
              captain: teamASquad[1].name,
              viceCaptain: teamASquad[5].name,
            },
            CSK: {
              squad: teamBSquad.map((item) => item.name),
              playingXI: teamBSquad.map((item) => item.name),
              bench: [],
              captain: teamBSquad[1].name,
              viceCaptain: teamBSquad[5].name,
            },
          },
        },
        200,
      )

      const teamPool = await apiCall(
        authedRequest,
        'GET',
        `/team-pool?contestId=${encodeURIComponent(fantasyContestId)}&matchId=${encodeURIComponent(matchId)}&userId=${encodeURIComponent(String(actorNumericUserId))}`,
        undefined,
        200,
      )
      const teamAPlayers = teamPool?.teams?.teamA?.players || []
      const teamBPlayers = teamPool?.teams?.teamB?.players || []
      const selectedXi = buildValidPlayingXi(teamAPlayers, teamBPlayers)
      const captain =
        selectedXi.find((player) => player.name === teamASquad[1].name) || selectedXi[0]
      const viceCaptain =
        selectedXi.find((player) => player.name === teamBSquad[7].name) ||
        selectedXi.find((player) => player.id !== captain.id) ||
        selectedXi[1]
      const selectedIds = selectedXi.map((player) => player.id)
      const backupIds = [...teamAPlayers, ...teamBPlayers]
        .filter((player) => !selectedIds.includes(player.id))
        .slice(0, 2)
        .map((player) => player.id)

      await apiCall(
        authedRequest,
        'POST',
        `/matches/${matchId}/team`,
        {
          contestId: fantasyContestId,
          playingXi: selectedIds,
          backups: backupIds,
          captainId: captain.id,
          viceCaptainId: viceCaptain.id,
        },
        200,
      )

      const scoreSave = await apiCall(
        authedRequest,
        'POST',
        '/admin/match-scores/upsert',
        {
          tournamentId: createdTournamentRowId,
          matchId,
          userId: actorUserId,
          playerStats: [
            {
              playerId: captain.id,
              playerName: captain.name,
              runs: 40,
              fours: 4,
              sixes: 1,
            },
            {
              playerId: viceCaptain.id,
              playerName: viceCaptain.name,
              wickets: 2,
              maidens: 1,
            },
          ],
        },
        200,
      )
      expect(Number(scoreSave?.impactedContests || 0)).toBeGreaterThanOrEqual(2)
      expect(
        (scoreSave?.contestSummaries || []).some(
          (row) =>
            String(row?.contestId) === String(fantasyContestId) &&
            Number(row?.updatedUsers || 0) >= 1,
        ),
      ).toBe(true)
      expect(
        (scoreSave?.contestSummaries || []).some(
          (row) =>
            String(row?.contestId) === String(auctionContestId) &&
            Number(row?.updatedUsers || 0) >= 1,
        ),
      ).toBe(true)

      const playerStats = await apiCall(
        authedRequest,
        'GET',
        `/player-stats?tournamentId=${encodeURIComponent(String(createdTournamentRowId))}`,
        undefined,
        200,
      )
      const captainStats = (playerStats || []).find((row) => row.name === captain.name)
      expect(Number(captainStats?.runs || 0)).toBe(40)
      expect(Number(captainStats?.points || 0)).toBeGreaterThan(0)

      const fantasyLeaderboard = await apiCall(
        authedRequest,
        'GET',
        `/contests/${fantasyContestId}/leaderboard`,
        undefined,
        200,
      )
      const fantasyRow = (fantasyLeaderboard || []).find(
        (row) =>
          String(row.userId) === String(actorNumericUserId) ||
          String(row.gameName || '').toLowerCase() === actorUserId.toLowerCase(),
      )
      expect(Number(fantasyRow?.points || 0)).toBeGreaterThan(0)

      const auctionLeaderboard = await apiCall(
        authedRequest,
        'GET',
        `/contests/${auctionContestId}/leaderboard`,
        undefined,
        200,
      )
      const auctionRow = (auctionLeaderboard || []).find(
        (row) =>
          String(row.userId) === importedAuctionUserId ||
          String(row.gameName || '').toLowerCase() ===
            importedAuctionUserId.toLowerCase(),
      )
      expect(Number(auctionRow?.points || 0)).toBeGreaterThan(0)

      const pageLoad = await apiCall(
        authedRequest,
        'GET',
        '/page-load-data',
        undefined,
        200,
      )
      const updatedRules = JSON.parse(JSON.stringify(pageLoad?.pointsRuleTemplate || {}))
      const runRule = (updatedRules?.batting || []).find((row) => row.id === 'run')
      expect(runRule).toBeTruthy()
      runRule.value = Number(runRule.value || 0) + 1

      const scoringSave = await apiCall(
        authedRequest,
        'POST',
        '/scoring-rules/save',
        {
          actorUserId,
          rules: updatedRules,
        },
        200,
      )
      expect(
        Number(scoringSave?.rebuildSummary?.rebuiltMatches || 0),
      ).toBeGreaterThanOrEqual(1)
      expect(
        Number(scoringSave?.rebuildSummary?.rebuiltContests || 0),
      ).toBeGreaterThanOrEqual(2)

      const playerStatsAfterRuleChange = await apiCall(
        authedRequest,
        'GET',
        `/player-stats?tournamentId=${encodeURIComponent(String(createdTournamentRowId))}`,
        undefined,
        200,
      )
      const captainStatsAfterRuleChange = (playerStatsAfterRuleChange || []).find(
        (row) => row.name === captain.name,
      )
      expect(Number(captainStatsAfterRuleChange?.points || 0)).toBeGreaterThan(
        Number(captainStats?.points || 0),
      )

      const fantasyLeaderboardAfterRuleChange = await apiCall(
        authedRequest,
        'GET',
        `/contests/${fantasyContestId}/leaderboard`,
        undefined,
        200,
      )
      const fantasyRowAfterRuleChange = (fantasyLeaderboardAfterRuleChange || []).find(
        (row) =>
          String(row.userId) === String(actorNumericUserId) ||
          String(row.gameName || '').toLowerCase() === actorUserId.toLowerCase(),
      )
      expect(Number(fantasyRowAfterRuleChange?.points || 0)).toBeGreaterThan(
        Number(fantasyRow?.points || 0),
      )

      const auctionLeaderboardAfterRuleChange = await apiCall(
        authedRequest,
        'GET',
        `/contests/${auctionContestId}/leaderboard`,
        undefined,
        200,
      )
      const auctionRowAfterRuleChange = (auctionLeaderboardAfterRuleChange || []).find(
        (row) =>
          String(row.userId) === importedAuctionUserId ||
          String(row.gameName || '').toLowerCase() ===
            importedAuctionUserId.toLowerCase(),
      )
      expect(Number(auctionRowAfterRuleChange?.points || 0)).toBeGreaterThan(
        Number(auctionRow?.points || 0),
      )
    } finally {
      if (KEEP_DB_SMOKE_DATA) {
        await authedRequest?.dispose()
        return
      }
      if (fantasyContestId) {
        try {
          await authedRequest?.fetch(
            `${E2E_API_BASE}/admin/contests/${fantasyContestId}`,
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              data: { actorUserId },
            },
          )
        } catch {}
      }
      if (auctionContestId) {
        try {
          await authedRequest?.fetch(
            `${E2E_API_BASE}/admin/contests/${auctionContestId}`,
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              data: { actorUserId },
            },
          )
        } catch {}
      }
      for (const playerId of createdPlayerIds) {
        try {
          await authedRequest?.fetch(`${E2E_API_BASE}/admin/players/${playerId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            data: { actorUserId },
          })
        } catch {}
      }
      if (createdTournamentRowId || tournamentSourceId) {
        try {
          await authedRequest?.fetch(
            `${E2E_API_BASE}/admin/tournaments/${createdTournamentRowId || tournamentSourceId}`,
            {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              data: { actorUserId },
            },
          )
        } catch {}
      }
      await authedRequest?.dispose()
    }
  })

  test('db public tournament and contest feeds return created fantasy data', async ({
    page,
  }) => {
    requireDbMasterCreds()
    const tag = Date.now()
    const tournamentName = `DB Fantasy Feed ${tag}`
    const tournamentId = normalizeTournamentId(`${tournamentName}-2026`)
    const contestName = `DB Fantasy Contest ${tag}`
    const teamASquad = buildTournamentSquad('AAA', `Alpha ${tag}`, 'India').map(
      (player) => ({
        ...player,
        sourceKey: `${player.sourceKey}-${tag}`,
      }),
    )
    const teamBSquad = buildTournamentSquad('BBB', `Bravo ${tag}`, 'India').map(
      (player) => ({
        ...player,
        sourceKey: `${player.sourceKey}-${tag}`,
      }),
    )
    let authState = null
    let authedRequest = null

    try {
      const anonymousRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
        },
      })
      authState = await apiCall(
        anonymousRequest,
        'POST',
        '/auth/login',
        { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
        200,
      )
      await anonymousRequest.dispose()

      authedRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
      })

      await apiCall(
        authedRequest,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: MASTER_LOGIN,
          tournamentId,
          name: tournamentName,
          season: '2026',
          source: 'json',
          tournamentType: 'league',
          country: 'india',
          league: 'IPL',
          selectedTeams: ['AAA', 'BBB'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'AAA',
              away: 'BBB',
              startAt: '2099-03-10T14:00:00.000Z',
              timezone: 'Asia/Kolkata',
              venue: 'Chennai',
            },
          ],
        },
        201,
      )

      const adminCatalog = await apiCall(
        authedRequest,
        'GET',
        '/admin/tournaments/catalog',
        undefined,
        200,
      )
      const createdTournament = (adminCatalog || []).find(
        (row) => row.sourceKey === tournamentId,
      )
      expect(createdTournament).toBeTruthy()
      trackSmokeArtifact('tournamentIds', createdTournament?.id)
      trackSmokeArtifact('tournamentSourceKeys', tournamentId)
      await apiCall(
        authedRequest,
        'POST',
        '/admin/team-squads',
        {
          actorUserId: MASTER_LOGIN,
          teamCode: 'AAA',
          teamName: 'Alpha',
          tournamentType: 'tournament',
          tournamentId: createdTournament.id,
          tournament: tournamentName,
          country: 'india',
          league: 'IPL',
          squad: teamASquad,
          source: 'manual',
        },
        201,
      )
      await apiCall(
        authedRequest,
        'POST',
        '/admin/team-squads',
        {
          actorUserId: MASTER_LOGIN,
          teamCode: 'BBB',
          teamName: 'Bravo',
          tournamentType: 'tournament',
          tournamentId: createdTournament.id,
          tournament: tournamentName,
          country: 'india',
          league: 'IPL',
          squad: teamBSquad,
          source: 'manual',
        },
        201,
      )
      await apiCall(
        authedRequest,
        'POST',
        '/admin/tournaments/enable',
        { ids: [createdTournament.id], actorUserId: MASTER_LOGIN },
        200,
      )
      const contestMatchOptions = await apiCall(
        authedRequest,
        'GET',
        `/admin/contest-match-options?tournamentId=${createdTournament.id}`,
        undefined,
        200,
      )
      const matchIds = (contestMatchOptions || []).map((row) => row.id)
      expect(matchIds.length).toBeGreaterThan(0)

      await apiCall(
        authedRequest,
        'POST',
        '/admin/contests',
        {
          name: contestName,
          tournamentId: String(createdTournament.id),
          game: 'Fantasy',
          teams: 10,
          maxParticipants: 10,
          status: 'Open',
          createdBy: MASTER_LOGIN,
          matchIds,
        },
        201,
      )

      const publicTournaments = await apiCall(
        authedRequest,
        'GET',
        '/tournaments',
        undefined,
        200,
      )
      expect(
        (publicTournaments || []).some((row) => row.sourceKey === tournamentId),
      ).toBe(true)

      const publicContests = await apiCall(
        authedRequest,
        'GET',
        `/contests?game=Fantasy&userId=${encodeURIComponent(MASTER_LOGIN)}`,
        undefined,
        200,
      )
      const createdContest = (publicContests || []).find(
        (row) => row.name === contestName,
      )
      expect(createdContest).toBeTruthy()
      trackSmokeArtifact('contestIds', createdContest?.id)
      await apiCall(
        authedRequest,
        'POST',
        `/contests/${createdContest.id}/join`,
        { userId: MASTER_LOGIN },
        200,
      )
      const contestsAfterJoin = await apiCall(
        authedRequest,
        'GET',
        `/contests?game=Fantasy&userId=${encodeURIComponent(MASTER_LOGIN)}`,
        undefined,
        200,
      )
      const joinedContest = (contestsAfterJoin || []).find(
        (row) => row.name === contestName,
      )
      expect(joinedContest?.joined).toBe(true)
      expect(Number(joinedContest?.joinedCount || 0)).toBeGreaterThan(0)
      const teamPool = await apiCall(
        authedRequest,
        'GET',
        `/team-pool?contestId=${createdContest.id}&matchId=${matchIds[0]}&userId=${encodeURIComponent(MASTER_LOGIN)}`,
        undefined,
        200,
      )
      const teamAPlayers = teamPool?.teams?.teamA?.players || []
      const teamBPlayers = teamPool?.teams?.teamB?.players || []
      const playingXi = buildValidPlayingXi(teamAPlayers, teamBPlayers)
      await apiCall(
        authedRequest,
        'POST',
        '/team-selection/save',
        {
          contestId: createdContest.id,
          matchId: matchIds[0],
          userId: MASTER_LOGIN,
          playingXi: playingXi.map((player) => player.id),
          backups: [],
          captainId: playingXi[0]?.id,
          viceCaptainId: playingXi[1]?.id,
        },
        200,
      )
      const participantPayload = await apiCall(
        authedRequest,
        'GET',
        `/contests/${createdContest.id}/participants?matchId=${encodeURIComponent(matchIds[0])}&userId=${encodeURIComponent(MASTER_LOGIN)}`,
        undefined,
        200,
      )
      expect(Array.isArray(participantPayload?.participants)).toBe(true)
      expect(Number(participantPayload?.joinedCount || 0)).toBeGreaterThan(0)
      expect((participantPayload?.participants || []).length).toBeGreaterThan(0)

      await page.goto('/login')
      await page.evaluate((session) => {
        window.localStorage.setItem('myxi-user', JSON.stringify(session))
        if (session?.token) {
          window.localStorage.setItem('myxi-token', session.token)
        }
      }, authState)
      await page.goto('/fantasy')
      await expect(
        page.locator('.tournament-filter-tile', { hasText: tournamentName }).first(),
      ).toBeVisible()
      await page
        .locator('.tournament-filter-tile', { hasText: tournamentName })
        .first()
        .click()
      await expect(
        page.locator('article.compact-contest-card', { hasText: contestName }).first(),
      ).toBeVisible()
      await page.goto(
        `/tournaments/${createdTournament.id}/contests/${createdContest.id}`,
      )
      await expect(page.getByText('No matches found')).toHaveCount(0)
      await expect(page.locator('.match-table tbody tr')).toHaveCount(1)
      await expect(page.locator('.match-table tbody')).toContainText('AAA')
      await expect(page.locator('.match-table tbody')).toContainText('BBB')
      await expect(
        page
          .locator('.match-table tbody tr')
          .first()
          .getByLabel(/Edit team|Add team/),
      ).toBeVisible()
      const matchRow = page.locator('.match-table tbody tr').first()
      await expect(matchRow.getByLabel('View team')).toContainText('(1)')
      await matchRow.click()
      await expect(page.locator('.participants-table tbody tr')).toHaveCount(1)
      await page
        .locator('.participants-table tbody tr')
        .first()
        .getByLabel(/View .* team/)
        .click()
      await expect(page.locator('.team-preview-drawer.open')).toBeVisible()
    } finally {
      if (authedRequest) {
        try {
          const catalog = await apiCall(
            authedRequest,
            'GET',
            '/admin/tournaments/catalog',
            undefined,
            200,
          )
          const tournament = (catalog || []).find((row) => row.sourceKey === tournamentId)
          if (tournament?.id && !KEEP_DB_SMOKE_DATA) {
            await authedRequest.fetch(
              `${E2E_API_BASE}/admin/tournaments/${tournament.id}`,
              {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                data: { actorUserId: MASTER_LOGIN },
              },
            )
          }
        } catch {
          // best effort cleanup
        }
        await authedRequest.dispose()
      }
    }
  })

  test('db /match-scores/save JSON payload updates contest_scores-derived leaderboard', async () => {
    requireDbMasterCreds()
    const tag = Date.now()
    const tournamentName = `DB Save Endpoint ${tag}`
    const tournamentId = normalizeTournamentId(`${tournamentName}-2026`)
    const contestName = `DB Save Contest ${tag}`
    const teamASquad = buildTournamentSquad('AAA', `Alpha ${tag}`, 'India').map(
      (player, index) => ({
        ...player,
        playerId: `db-save-${tag}-a-${index + 1}`,
        sourceKey: `${player.sourceKey}-${tag}-a`,
      }),
    )
    const teamBSquad = buildTournamentSquad('BBB', `Bravo ${tag}`, 'India').map(
      (player, index) => ({
        ...player,
        playerId: `db-save-${tag}-b-${index + 1}`,
        sourceKey: `${player.sourceKey}-${tag}-b`,
      }),
    )
    let authedRequest = null

    try {
      const anonymousRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
        },
      })
      const authState = await apiCall(
        anonymousRequest,
        'POST',
        '/auth/login',
        { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
        200,
      )
      await anonymousRequest.dispose()

      const actorUserId =
        authState?.user?.userId ||
        authState?.user?.gameName ||
        authState?.user?.email ||
        MASTER_LOGIN
      authedRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
      })

      const tournamentCreate = await apiCall(
        authedRequest,
        'POST',
        '/admin/tournaments',
        {
          actorUserId,
          tournamentId,
          name: tournamentName,
          season: '2026',
          source: 'json',
          tournamentType: 'league',
          country: 'india',
          league: 'IPL',
          selectedTeams: ['AAA', 'BBB'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'AAA',
              away: 'BBB',
              startAt: '2099-03-10T14:00:00.000Z',
              timezone: 'Asia/Kolkata',
              venue: 'Chennai',
            },
          ],
        },
        201,
      )
      const createdTournamentId = tournamentCreate?.tournament?.id
      expect(createdTournamentId).toBeTruthy()
      trackSmokeArtifact('tournamentIds', createdTournamentId)
      trackSmokeArtifact('tournamentSourceKeys', tournamentId)

      await apiCall(
        authedRequest,
        'POST',
        '/admin/team-squads',
        {
          actorUserId,
          teamCode: 'AAA',
          teamName: 'Alpha',
          tournamentType: 'tournament',
          tournamentId: createdTournamentId,
          tournament: tournamentName,
          country: 'india',
          league: 'IPL',
          squad: teamASquad,
          source: 'manual',
        },
        201,
      )
      await apiCall(
        authedRequest,
        'POST',
        '/admin/team-squads',
        {
          actorUserId,
          teamCode: 'BBB',
          teamName: 'Bravo',
          tournamentType: 'tournament',
          tournamentId: createdTournamentId,
          tournament: tournamentName,
          country: 'india',
          league: 'IPL',
          squad: teamBSquad,
          source: 'manual',
        },
        201,
      )

      await apiCall(
        authedRequest,
        'POST',
        '/admin/tournaments/enable',
        { ids: [createdTournamentId], actorUserId },
        200,
      )

      const contestMatchOptions = await apiCall(
        authedRequest,
        'GET',
        `/admin/contest-match-options?tournamentId=${createdTournamentId}`,
        undefined,
        200,
      )
      const matchId = String((contestMatchOptions || [])[0]?.id || '')
      expect(matchId).toBeTruthy()

      const contest = await apiCall(
        authedRequest,
        'POST',
        '/admin/contests',
        {
          name: contestName,
          tournamentId: String(createdTournamentId),
          game: 'Fantasy',
          teams: 10,
          maxParticipants: 10,
          status: 'Open',
          createdBy: actorUserId,
          matchIds: [matchId],
        },
        201,
      )
      const contestId = contest?.id || contest?.contest?.id
      expect(contestId).toBeTruthy()
      trackSmokeArtifact('contestIds', contestId)

      await apiCall(
        authedRequest,
        'POST',
        `/contests/${contestId}/join`,
        { userId: actorUserId },
        200,
      )

      const teamPool = await apiCall(
        authedRequest,
        'GET',
        `/team-pool?contestId=${encodeURIComponent(contestId)}&matchId=${encodeURIComponent(matchId)}&userId=${encodeURIComponent(actorUserId)}`,
        undefined,
        200,
      )
      const playingXi = buildValidPlayingXi(
        teamPool?.teams?.teamA?.players || [],
        teamPool?.teams?.teamB?.players || [],
      )

      await apiCall(
        authedRequest,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId,
          userId: actorUserId,
          playingXi: playingXi.map((player) => player.id),
          backups: [],
          captainId: playingXi[0]?.id,
          viceCaptainId: playingXi[1]?.id,
        },
        200,
      )

      const payloadText = JSON.stringify({
        playerStats: [
          {
            playerId: playingXi[0]?.id,
            playerName: playingXi[0]?.name,
            runs: 52,
            ballsFaced: 30,
            fours: 6,
            sixes: 2,
            dismissed: true,
          },
          {
            playerId: playingXi[1]?.id,
            playerName: playingXi[1]?.name,
            wickets: 2,
            oversBowled: 4,
            runsConceded: 24,
            maidens: 1,
            wides: 1,
          },
        ],
      })

      const saveResponse = await apiCall(
        authedRequest,
        'POST',
        '/match-scores/save',
        {
          payloadText,
          source: 'json',
          tournamentId: String(createdTournamentId),
          matchId: String(matchId),
          contestId: String(contestId),
          userId: actorUserId,
        },
        200,
      )
      expect(saveResponse?.ok).toBe(true)
      expect(Number(saveResponse?.impactedContests || 0)).toBeGreaterThan(0)

      const leaderboard = await apiCall(
        authedRequest,
        'GET',
        `/contests/${contestId}/leaderboard`,
        undefined,
        200,
      )
      expect(Array.isArray(leaderboard)).toBe(true)
      const hasPositivePoints = (leaderboard || []).some(
        (row) => Number(row?.points || 0) > 0,
      )
      expect(hasPositivePoints).toBe(true)
    } finally {
      if (authedRequest) {
        try {
          const catalog = await apiCall(
            authedRequest,
            'GET',
            '/admin/tournaments/catalog',
            undefined,
            200,
          )
          const tournament = (catalog || []).find((row) => row.sourceKey === tournamentId)
          if (tournament?.id && !KEEP_DB_SMOKE_DATA) {
            await authedRequest.fetch(
              `${E2E_API_BASE}/admin/tournaments/${tournament.id}`,
              {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                data: { actorUserId: MASTER_LOGIN },
              },
            )
          }
        } catch {
          // best effort cleanup
        }
        await authedRequest.dispose()
      }
    }
  })

  test('db /match-scores/save rejects player stats from different match teams', async () => {
    requireDbMasterCreds()
    const tag = Date.now()
    const tournamentName = `DB Wrong Match Guard ${tag}`
    const tournamentId = normalizeTournamentId(`${tournamentName}-2026`)
    let authedRequest = null

    try {
      const anonymousRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
        },
      })
      const authState = await apiCall(
        anonymousRequest,
        'POST',
        '/auth/login',
        { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
        200,
      )
      await anonymousRequest.dispose()

      const actorUserId =
        authState?.user?.userId ||
        authState?.user?.gameName ||
        authState?.user?.email ||
        MASTER_LOGIN

      authedRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
      })

      const tournamentCreate = await apiCall(
        authedRequest,
        'POST',
        '/admin/tournaments',
        {
          actorUserId,
          tournamentId,
          name: tournamentName,
          season: '2026',
          source: 'json',
          tournamentType: 'league',
          country: 'india',
          league: 'IPL',
          selectedTeams: ['KKR', 'CSK', 'RCB', 'SRH'],
          matches: [
            {
              id: 'm-kkr-csk',
              matchNo: 1,
              home: 'KKR',
              away: 'CSK',
              startAt: '2099-03-10T14:00:00.000Z',
            },
            {
              id: 'm-rcb-srh',
              matchNo: 2,
              home: 'RCB',
              away: 'SRH',
              startAt: '2099-03-11T14:00:00.000Z',
            },
          ],
        },
        201,
      )
      const createdTournamentId = tournamentCreate?.tournament?.id
      expect(createdTournamentId).toBeTruthy()
      trackSmokeArtifact('tournamentIds', createdTournamentId)
      trackSmokeArtifact('tournamentSourceKeys', tournamentId)

      const buildSquad = (prefix) =>
        Array.from({ length: 11 }).map((_, index) => ({
          name: `${prefix} Player ${index + 1} ${tag}`,
          country: 'india',
          role: index === 0 ? 'WK' : index < 6 ? 'BAT' : 'BOWL',
          playerId: `db-wrong-${prefix}-${tag}-${index + 1}`,
          sourceKey: `db-wrong-${prefix}-${tag}-${index + 1}`,
          active: true,
        }))

      for (const teamCode of ['KKR', 'CSK', 'RCB', 'SRH']) {
        await apiCall(
          authedRequest,
          'POST',
          '/admin/team-squads',
          {
            actorUserId,
            teamCode,
            teamName: teamCode,
            tournamentType: 'tournament',
            tournamentId: createdTournamentId,
            tournament: tournamentName,
            country: 'india',
            league: 'IPL',
            squad: buildSquad(teamCode),
            source: 'manual',
          },
          201,
        )
      }

      const tournamentMatches = await apiCall(
        authedRequest,
        'GET',
        `/tournaments/${createdTournamentId}/matches`,
        undefined,
        200,
      )
      const selectedMatch = (tournamentMatches || []).find((row) => {
        const home = String(row?.teamAKey || row?.teamA || '').toUpperCase()
        const away = String(row?.teamBKey || row?.teamB || '').toUpperCase()
        return home === 'KKR' && away === 'CSK'
      })
      expect(selectedMatch?.id).toBeTruthy()

      const saveResponse = await authedRequest.fetch(
        `${E2E_API_BASE}/match-scores/save`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: {
            source: 'json',
            tournamentId: String(createdTournamentId),
            matchId: String(selectedMatch.id),
            userId: actorUserId,
            payloadText: JSON.stringify({
              playerStats: [
                {
                  playerName: `RCB Player 1 ${tag}`,
                  runs: 55,
                  ballsFaced: 30,
                  fours: 6,
                  sixes: 2,
                  dismissed: true,
                },
              ],
            }),
          },
        },
      )

      expect(saveResponse.status()).toBe(400)
      const body = await saveResponse.json()
      expect(body?.message || '').toContain('not in selected match teams')
      expect(Array.isArray(body?.unmatchedPlayers)).toBe(true)
      expect(body?.unmatchedPlayers || []).toContain(`RCB Player 1 ${tag}`)
      expect(Array.isArray(body?.unmatchedDetails)).toBe(true)
      expect(body?.unmatchedDetails?.[0]?.input).toBe(`RCB Player 1 ${tag}`)
      expect(Array.isArray(body?.unmatchedDetails?.[0]?.suggestions)).toBe(true)
    } finally {
      if (authedRequest) {
        try {
          const catalog = await apiCall(
            authedRequest,
            'GET',
            '/admin/tournaments/catalog',
            undefined,
            200,
          )
          const tournament = (catalog || []).find((row) => row.sourceKey === tournamentId)
          if (tournament?.id && !KEEP_DB_SMOKE_DATA) {
            await authedRequest.fetch(
              `${E2E_API_BASE}/admin/tournaments/${tournament.id}`,
              {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                data: { actorUserId: MASTER_LOGIN },
              },
            )
          }
        } catch {
          // best effort cleanup
        }
        await authedRequest.dispose()
      }
    }
  })

  test('db /match-scores/save accepts common name aliases without playerId', async () => {
    requireDbMasterCreds()
    const tag = Date.now()
    const tournamentName = `DB Name Alias Guard ${tag}`
    const tournamentId = normalizeTournamentId(`${tournamentName}-2026`)
    let authedRequest = null

    try {
      const anonymousRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
        },
      })
      const authState = await apiCall(
        anonymousRequest,
        'POST',
        '/auth/login',
        { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
        200,
      )
      await anonymousRequest.dispose()

      const actorUserId =
        authState?.user?.userId ||
        authState?.user?.gameName ||
        authState?.user?.email ||
        MASTER_LOGIN

      authedRequest = await playwrightRequest.newContext({
        baseURL: E2E_API_BASE,
        extraHTTPHeaders: {
          Authorization: `Bearer ${authState.token}`,
          'Content-Type': 'application/json',
        },
      })

      const tournamentCreate = await apiCall(
        authedRequest,
        'POST',
        '/admin/tournaments',
        {
          actorUserId,
          tournamentId,
          name: tournamentName,
          season: '2026',
          source: 'json',
          tournamentType: 'league',
          country: 'india',
          league: 'IPL',
          selectedTeams: ['RCB', 'SRH'],
          matches: [
            {
              id: 'm-rcb-srh',
              matchNo: 1,
              home: 'RCB',
              away: 'SRH',
              startAt: '2099-03-11T14:00:00.000Z',
            },
          ],
        },
        201,
      )
      const createdTournamentId = tournamentCreate?.tournament?.id
      expect(createdTournamentId).toBeTruthy()
      trackSmokeArtifact('tournamentIds', createdTournamentId)
      trackSmokeArtifact('tournamentSourceKeys', tournamentId)

      const buildSquad = (prefix, withAlias = false) =>
        Array.from({ length: 11 }).map((_, index) => {
          if (withAlias && index === 0) {
            return {
              name: 'Phil Salt',
              country: 'england',
              role: 'WK',
              playerId: `db-alias-phil-salt-${tag}`,
              sourceKey: `db-alias-phil-salt-${tag}`,
              active: true,
            }
          }
          return {
            name: `${prefix} Player ${index + 1} ${tag}`,
            country: 'india',
            role: index === 0 ? 'WK' : index < 6 ? 'BAT' : 'BOWL',
            playerId: `db-alias-${prefix}-${tag}-${index + 1}`,
            sourceKey: `db-alias-${prefix}-${tag}-${index + 1}`,
            active: true,
          }
        })

      await apiCall(
        authedRequest,
        'POST',
        '/admin/team-squads',
        {
          actorUserId,
          teamCode: 'RCB',
          teamName: 'RCB',
          tournamentType: 'tournament',
          tournamentId: createdTournamentId,
          tournament: tournamentName,
          country: 'india',
          league: 'IPL',
          squad: buildSquad('RCB', true),
          source: 'manual',
        },
        201,
      )

      await apiCall(
        authedRequest,
        'POST',
        '/admin/team-squads',
        {
          actorUserId,
          teamCode: 'SRH',
          teamName: 'SRH',
          tournamentType: 'tournament',
          tournamentId: createdTournamentId,
          tournament: tournamentName,
          country: 'india',
          league: 'IPL',
          squad: buildSquad('SRH', false),
          source: 'manual',
        },
        201,
      )

      const tournamentMatches = await apiCall(
        authedRequest,
        'GET',
        `/tournaments/${createdTournamentId}/matches`,
        undefined,
        200,
      )
      const selectedMatch = (tournamentMatches || []).find((row) => {
        const home = String(row?.teamAKey || row?.teamA || '').toUpperCase()
        const away = String(row?.teamBKey || row?.teamB || '').toUpperCase()
        return home === 'RCB' && away === 'SRH'
      })
      expect(selectedMatch?.id).toBeTruthy()

      const saveResponse = await authedRequest.fetch(
        `${E2E_API_BASE}/match-scores/save`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: {
            source: 'json',
            tournamentId: String(createdTournamentId),
            matchId: String(selectedMatch.id),
            userId: actorUserId,
            payloadText: JSON.stringify({
              playerStats: [
                {
                  playerName: 'Philip Salt',
                  runs: 35,
                  ballsFaced: 21,
                  fours: 4,
                  sixes: 1,
                  dismissed: true,
                },
              ],
            }),
          },
        },
      )

      expect(saveResponse.status()).toBe(200)
      const body = await saveResponse.json()
      expect(body?.ok).toBe(true)
      expect(body?.savedScore?.matchId).toBe(String(selectedMatch.id))
      expect(Array.isArray(body?.savedScore?.playerStats)).toBe(true)
      expect(body?.savedScore?.playerStats?.[0]?.playerName).toBe('Phil Salt')
    } finally {
      if (authedRequest) {
        try {
          const catalog = await apiCall(
            authedRequest,
            'GET',
            '/admin/tournaments/catalog',
            undefined,
            200,
          )
          const tournament = (catalog || []).find((row) => row.sourceKey === tournamentId)
          if (tournament?.id && !KEEP_DB_SMOKE_DATA) {
            await authedRequest.fetch(
              `${E2E_API_BASE}/admin/tournaments/${tournament.id}`,
              {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                data: { actorUserId: MASTER_LOGIN },
              },
            )
          }
        } catch {
          // best effort cleanup
        }
        await authedRequest.dispose()
      }
    }
  })
})
