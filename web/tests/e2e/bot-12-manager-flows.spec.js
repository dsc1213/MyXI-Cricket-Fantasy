import { expect, test } from '@playwright/test'
import { apiCall, loginUi } from './helpers/mock-e2e.js'

const E2E_API_BASE = process.env.PW_E2E_API_BASE_URL || 'http://127.0.0.1:4000'

const normalizeTournamentId = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const buildTeamCodeFromName = (value = '') => {
  const words = value
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return ''
  const initials = words.map((part) => part[0]).join('')
  return (initials || words.join('')).slice(0, 6)
}

const selectTopActionPlayer = async (page, name) => {
  const select = page.locator('.top-actions select').first()
  const optionValue = await select
    .locator('option')
    .filter({ hasText: name })
    .first()
    .getAttribute('value')
  if (!optionValue) throw new Error(`No player option found for ${name}`)
  await select.selectOption(optionValue)
}

test.describe('12) Squad manager + tournament manager flows', () => {
  test.setTimeout(180000)

  test('squad manager manual + json save stays in sync after refresh', async ({ page, request }) => {
    const tag = Date.now()
    const teamName = `Mock E2E PSL Team ${tag}`
    const teamCode = buildTeamCodeFromName(teamName)
    const playerOne = `mocke2ebot-player-1-${tag}`
    const playerTwo = `mocke2ebot-player-2-${tag}`

    try {
      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Player Manager' }).click()

      await page.getByLabel('Name').fill(playerOne)
      await page.getByLabel('Country').fill('pakistan')
      await page.getByLabel('Role').selectOption('BAT')
      await page.getByLabel('Image URL').fill(`https://images.example.com/${playerOne}.png`)
      await page.getByRole('button', { name: 'Add player' }).click()
      await expect(page.getByText('Player saved')).toBeVisible()

      await page.getByLabel('Name').fill(playerTwo)
      await page.getByLabel('Country').fill('pakistan')
      await page.getByLabel('Role').selectOption('BOWL')
      await page.getByRole('button', { name: 'Add player' }).click()
      await expect(page.getByText('Player saved')).toBeVisible()

      await page.goto('/home')
      await page.getByRole('button', { name: 'Squad Manager' }).click()

      const scopeSelects = page.locator('.manual-scope-row').first().locator('select')
      await scopeSelects.nth(0).selectOption('league')
      await scopeSelects.nth(1).selectOption('pakistan')
      await scopeSelects.nth(2).selectOption('PSL')
      await scopeSelects.nth(3).selectOption('__new__')
      await page.getByLabel('Team code').fill(teamCode)
      await page.getByLabel('Team name').fill(teamName)

      await page.getByPlaceholder('Search player catalog').fill(playerOne)
      await selectTopActionPlayer(page, playerOne)
      await page.getByRole('button', { name: 'Add player' }).click()

      await page.getByPlaceholder('Search player catalog').fill(playerTwo)
      await selectTopActionPlayer(page, playerTwo)
      await page.getByRole('button', { name: 'Add player' }).click()

      await page.getByRole('button', { name: 'Save squad' }).click()
      await expect(page.getByText('Squad saved')).toBeVisible()

      const savedManual = await apiCall(
        request,
        'GET',
        `/admin/team-squads?teamCode=${teamCode}`,
        undefined,
        200,
      )
      expect(savedManual[0]?.teamName).toBe(teamName)
      expect(savedManual[0]?.squad?.length).toBe(2)
      expect(savedManual[0]?.squad?.[0]?.imageUrl).toBe(
        `https://images.example.com/${playerOne}.png`,
      )

      await page.reload()
      await page.getByRole('button', { name: 'Squad Manager' }).click()
      await scopeSelects.nth(0).selectOption('league')
      await scopeSelects.nth(1).selectOption('pakistan')
      await scopeSelects.nth(2).selectOption('PSL')
      await scopeSelects.nth(3).selectOption(teamCode)
      await expect(page.locator(`input[value="${playerOne}"]`).first()).toBeVisible()
      await expect(page.locator(`input[value="${playerTwo}"]`).first()).toBeVisible()

      await page.getByRole('tab', { name: 'JSON' }).click()
      const jsonPayload = {
        teamCode,
        teamName,
        tournamentType: 'league',
        country: 'pakistan',
        league: 'PSL',
        source: 'json',
        squad: [
          { name: playerOne, country: 'pakistan', role: 'BAT', active: true },
          { name: playerTwo, country: 'pakistan', role: 'BOWL', active: true },
          { name: `mocke2ebot-player-3-${tag}`, country: 'pakistan', role: 'AR', active: true },
        ],
      }
      await page.locator('textarea').fill(JSON.stringify(jsonPayload, null, 2))
      await page.getByRole('button', { name: 'Save squad' }).click()
      await expect(page.getByText('Squad saved')).toBeVisible()

      const savedJson = await apiCall(
        request,
        'GET',
        `/admin/team-squads?teamCode=${teamCode}`,
        undefined,
        200,
      )
      expect(savedJson[0]?.squad?.length).toBe(3)
      expect(savedJson[0]?.squad?.some((p) => p.name === `mocke2ebot-player-3-${tag}`)).toBe(true)
    } finally {
      try {
        await request.fetch(`${E2E_API_BASE}/admin/team-squads/${teamCode}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      } catch {
        // best effort cleanup
      }
    }
  })

  test('tournament manager manual + json create flows work', async ({ page, request }) => {
    const tag = Date.now()
    const manualName = `Mock E2E International ${tag}`
    const manualTournamentId = normalizeTournamentId(`${manualName}-2026`)
    const jsonTournamentId = `mock-e2e-json-${tag}`

    try {
      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Create Tournament' }).click()

      await page.getByLabel('Tournament name').fill(manualName)
      await page.getByLabel('Season').fill('2026')

      const teamsTable = page.locator('.create-tournament-teams-table')
      await expect(teamsTable.locator('tbody tr').first()).toBeVisible()
      await teamsTable.locator('thead input[type="checkbox"]').first().check()
      await page.getByRole('button', { name: 'Next' }).click()

      const matchRows = page.locator('.create-tournament-matches-table tbody tr')
      await expect(matchRows.first()).toBeVisible()
      const m1 = matchRows.nth(0)
      await m1.locator('select').nth(0).selectOption('IND')
      await m1.locator('select').nth(1).selectOption('AUS')
      await m1.locator('input[type="datetime-local"]').fill('2099-01-10T14:00')
      await m1.locator('select').nth(2).selectOption('UTC')
      await m1.locator('input[type="text"]').nth(0).fill('Delhi')
      await m1.locator('input[type="text"]').nth(1).fill('Arun Jaitley Stadium')

      const m2 = matchRows.nth(1)
      await m2.locator('select').nth(0).selectOption('ENG')
      await m2.locator('select').nth(1).selectOption('NZ')
      await m2.locator('input[type="datetime-local"]').fill('2099-01-11T14:00')
      await m2.locator('select').nth(2).selectOption('UTC')
      await m2.locator('input[type="text"]').nth(0).fill('London')
      await m2.locator('input[type="text"]').nth(1).fill("Lord's")

      await page.getByRole('button', { name: 'Save tournament' }).click()

      const catalogAfterManual = await apiCall(
        request,
        'GET',
        '/admin/tournaments/catalog',
        undefined,
        200,
      )
      expect(catalogAfterManual.some((row) => row.id === manualTournamentId)).toBe(true)

      await page.goto('/home')
      await page.getByRole('button', { name: 'Create Tournament' }).click()
      await page.getByRole('tab', { name: 'JSON' }).click()
      const jsonPayload = {
        name: `Mock JSON Tournament ${tag}`,
        season: '2026',
        tournamentId: jsonTournamentId,
        source: 'json',
        tournamentType: 'league',
        country: 'pakistan',
        league: 'PSL',
        selectedTeams: ['KAR', 'LAH', 'ISL', 'QUE'],
        matches: [
          {
            id: 'm1',
            matchNo: 1,
            home: 'KAR',
            away: 'LAH',
            startAt: '2099-03-10T14:00',
            timezone: 'Asia/Kolkata',
            location: 'Karachi',
            venue: 'National Stadium',
          },
          {
            id: 'm2',
            matchNo: 2,
            home: 'ISL',
            away: 'QUE',
            startAt: '2099-03-11T14:00',
            timezone: 'Asia/Kolkata',
            location: 'Lahore',
            venue: 'Gaddafi Stadium',
          },
        ],
      }
      await page.locator('textarea').fill(JSON.stringify(jsonPayload, null, 2))
      await page.getByRole('button', { name: 'Save tournament' }).click()

      const catalogAfterJson = await apiCall(
        request,
        'GET',
        '/admin/tournaments/catalog',
        undefined,
        200,
      )
      expect(catalogAfterJson.some((row) => row.id === jsonTournamentId)).toBe(true)
    } finally {
      try {
        await request.fetch(`${E2E_API_BASE}/admin/tournaments/${jsonTournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      } catch {
        // best effort cleanup
      }
      try {
        await request.fetch(`${E2E_API_BASE}/admin/tournaments/${manualTournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      } catch {
        // best effort cleanup
      }
    }
  })

  test('player manager adds and deletes a global player', async ({ page, request }) => {
    const tag = Date.now()
    const playerName = `Player Manager ${tag}`
    let createdPlayerId = null

    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Player Manager' }).click()

    await page.getByLabel('Name').fill(playerName)
    await page.getByLabel('Country').fill('india')
    await page.getByLabel('Role').selectOption('BAT')
    await page.getByLabel('Image URL').fill(`https://images.example.com/${tag}.png`)
    await page.getByRole('button', { name: 'Add player' }).click()
    await expect(page.getByText('Player saved')).toBeVisible()
    await expect(page.getByText(playerName)).toBeVisible()

    const playersAfterCreate = await apiCall(request, 'GET', '/players', undefined, 200)
    const createdPlayer = (playersAfterCreate || []).find((row) => {
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

    const row = page.locator('.catalog-table tbody tr', { hasText: playerName }).first()
    await row.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Player deleted')).toBeVisible()

    const playersAfterDelete = await apiCall(request, 'GET', '/players', undefined, 200)
    expect(
      (playersAfterDelete || []).some((row) => String(row.id) === String(createdPlayerId)),
    ).toBe(false)
  })

  test('master admin sees delete actions in Admin Manager with confirmation copy', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Admin Manager' }).click()

    await page.getByRole('tab', { name: 'Contests' }).click()
    await page.locator('.contest-section-head select').first().selectOption('t20wc-2026')
    const contestRow = page.locator('.catalog-table tbody tr', { hasText: 'Huntercherry Contest' })
    await expect(contestRow).toBeVisible()
    await expect(contestRow.getByRole('button', { name: 'Delete' })).toBeVisible()
    await contestRow.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Delete contest "Huntercherry Contest"?')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Delete contest "Huntercherry Contest"?')).toHaveCount(0)

    await page.getByRole('tab', { name: /Tournaments \(/ }).click()
    const tournamentRow = page.locator('.catalog-table tbody tr', { hasText: 'T20 World Cup 2026' })
    await expect(tournamentRow).toBeVisible()
    await expect(tournamentRow.getByRole('button', { name: 'Delete' })).toBeVisible()
    await tournamentRow.getByRole('button', { name: 'Delete' }).click()
    await expect(
      page.getByText('Delete tournament "T20 World Cup 2026" and all related contests?'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(
      page.getByText('Delete tournament "T20 World Cup 2026" and all related contests?'),
    ).toHaveCount(0)
  })

  test('mobile home navigation resets dashboard back to the main panel', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await loginUi(page, 'master')
    await page.goto('/home')

    await page.locator('#dashboard-panel-select').selectOption('admin')
    await expect(page.getByRole('heading', { name: 'Admin Manager' })).toBeVisible()

    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await page.getByRole('link', { name: 'Home' }).click()

    await expect(page).toHaveURL(/\/home\?panel=joined$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.locator('.mobile-nav-drawer')).not.toHaveClass(/open/)
  })

  test('squad manager shows canonical IPL teams even before a squad row exists', async ({ page }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Squad Manager' }).click()

    const scopeSelects = page.locator('.manual-scope-row').first().locator('select')
    await scopeSelects.nth(0).selectOption('league')
    await scopeSelects.nth(1).selectOption('india')
    await scopeSelects.nth(2).selectOption('IPL')
    await scopeSelects.nth(3).selectOption('CSK')

    await expect(page.getByRole('heading', { name: 'CSK Squad' })).toBeVisible()
    await expect(page.locator('input[placeholder=\"Player name\"]').first()).toBeVisible()
  })

  test('squad manager tournament scope lists created tournaments and their teams', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `squad-tour-${tag}`
    const tournamentName = `Squad Tournament ${tag}`

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: tournamentName,
          season: '2026',
          source: 'json',
          tournamentType: 'league',
          country: 'india',
          league: 'IPL',
          selectedTeams: ['CSK', 'MI'],
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

      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Squad Manager' }).click()

      const scopeSelects = page.locator('.manual-scope-row').first().locator('select')
      await scopeSelects.nth(0).selectOption('tournament')
      await scopeSelects.nth(1).selectOption(tournamentId)
      await scopeSelects.nth(2).selectOption('CSK')

      await expect(page.getByRole('heading', { name: 'CSK Squad' })).toBeVisible()
      await expect(page.getByText('No players')).toBeVisible()
    } finally {
      await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('tournament squad edits appear in team selection and fallback avatars use centered layout', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `tour-squad-sync-${tag}`
    const tournamentName = `Tournament Squad Sync ${tag}`
    let contestId = ''

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
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
              venue: 'Test Ground',
            },
          ],
        },
        201,
      )

      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Squad Manager' }).click()

      const scopeSelects = page.locator('.manual-scope-row').first().locator('select')
      await scopeSelects.nth(0).selectOption('tournament')
      await scopeSelects.nth(1).selectOption(tournamentId)
      await scopeSelects.nth(2).selectOption('AAA')

      const firstRow = page.locator('.catalog-table tbody tr').first()
      await firstRow.locator('input[placeholder="Player name"]').fill('Spencer Johnson')
      await firstRow.locator('select').nth(0).selectOption('australia')
      await firstRow.locator('select').nth(1).selectOption('BOWL')
      await page.getByRole('button', { name: 'Save squad' }).click()
      await expect(page.getByText('Squad saved')).toBeVisible()

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `Selection Sync Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 10,
          status: 'Open',
          joined: true,
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await page.goto(`/fantasy/select?contest=${contestId}&match=m1&mode=add`)
      await expect(page.getByText('Spencer Johnson (BOWL)')).toBeVisible()

      const fallbackStyles = await page.locator('.player-avatar-fallback').first().evaluate((node) => {
        const style = window.getComputedStyle(node)
        return {
          display: style.display,
          alignItems: style.alignItems,
          justifyContent: style.justifyContent,
        }
      })
      expect(fallbackStyles).toEqual({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      })
    } finally {
      if (contestId) {
        await request.fetch(`${E2E_API_BASE}/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('squad manager can link an existing player into another tournament without creating duplicates', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const playerName = `Linked Player ${tag}`
    const tournamentAId = `player-link-a-${tag}`
    const tournamentBId = `player-link-b-${tag}`

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId: tournamentAId,
          name: `Player Link A ${tag}`,
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
              venue: 'A Ground',
            },
          ],
        },
        201,
      )
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId: tournamentBId,
          name: `Player Link B ${tag}`,
          season: '2026',
          source: 'json',
          tournamentType: 'league',
          country: 'australia',
          league: 'BBL',
          selectedTeams: ['CCC', 'DDD'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'CCC',
              away: 'DDD',
              startAt: '2099-03-11T14:00:00.000Z',
              timezone: 'Australia/Sydney',
              venue: 'B Ground',
            },
          ],
        },
        201,
      )

      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Player Manager' }).click()
      await page.getByLabel('Name').fill(playerName)
      await page.getByLabel('Country').fill('south africa')
      await page.getByLabel('Role').selectOption('BAT')
      await page.getByRole('button', { name: 'Add player' }).click()
      await expect(page.getByText('Player saved')).toBeVisible()

      await page.goto('/home')
      await page.getByRole('button', { name: 'Squad Manager' }).click()

      const scopeSelects = page.locator('.manual-scope-row').first().locator('select')
      await scopeSelects.nth(0).selectOption('tournament')
      await scopeSelects.nth(1).selectOption(tournamentAId)
      await scopeSelects.nth(2).selectOption('AAA')
      await expect(page.getByText('No players')).toBeVisible()
      await page.getByPlaceholder('Search player catalog').fill(playerName)
      await selectTopActionPlayer(page, playerName)
      await page.getByRole('button', { name: 'Add player' }).click()
      await page.getByRole('button', { name: 'Save squad' }).click()
      await expect(page.getByText('Squad saved')).toBeVisible()

      const playersAfterFirstSave = await apiCall(request, 'GET', '/players', undefined, 200)
      expect(
        (playersAfterFirstSave || []).filter((row) => {
          const name = (
            row.displayName ||
            row.name ||
            [row.firstName, row.lastName].filter(Boolean).join(' ')
          )
            .toString()
            .trim()
          return name === playerName
        }),
      ).toHaveLength(1)

      await scopeSelects.nth(1).selectOption(tournamentBId)
      await scopeSelects.nth(2).selectOption('CCC')

      await expect(page.getByText('No players')).toBeVisible()
      await page.getByPlaceholder('Search player catalog').fill(playerName)
      await selectTopActionPlayer(page, playerName)
      await page.getByRole('button', { name: 'Add player' }).click()
      await page.getByRole('button', { name: 'Save squad' }).click()
      await expect(page.getByText('Squad saved')).toBeVisible()

      const playersAfterLink = await apiCall(request, 'GET', '/players', undefined, 200)
      expect(
        (playersAfterLink || []).filter((row) => {
          const name = (
            row.displayName ||
            row.name ||
            [row.firstName, row.lastName].filter(Boolean).join(' ')
          )
            .toString()
            .trim()
          return name === playerName
        }),
      ).toHaveLength(1)
    } finally {
      await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentAId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
      await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentBId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('editing a linked player updates the shared identity across tournament squads', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const originalName = `Shared Player ${tag}`
    const updatedName = `Shared Player Updated ${tag}`
    const tournamentAId = `player-edit-a-${tag}`
    const tournamentBId = `player-edit-b-${tag}`

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId: tournamentAId,
          name: `Player Edit A ${tag}`,
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
              startAt: '2099-03-12T14:00:00.000Z',
              timezone: 'Asia/Kolkata',
              venue: 'A Ground',
            },
          ],
        },
        201,
      )
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId: tournamentBId,
          name: `Player Edit B ${tag}`,
          season: '2026',
          source: 'json',
          tournamentType: 'league',
          country: 'australia',
          league: 'BBL',
          selectedTeams: ['CCC', 'DDD'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'CCC',
              away: 'DDD',
              startAt: '2099-03-13T14:00:00.000Z',
              timezone: 'Australia/Sydney',
              venue: 'B Ground',
            },
          ],
        },
        201,
      )

      await apiCall(
        request,
        'POST',
        '/admin/team-squads',
        {
          actorUserId: 'master',
          teamCode: 'AAA',
          teamName: 'AAA',
          tournamentType: 'tournament',
          tournamentId: tournamentAId,
          tournament: `Player Edit A ${tag}`,
          squad: [{ name: originalName, country: 'south africa', role: 'BAT', active: true }],
        },
        201,
      )
      await apiCall(
        request,
        'POST',
        '/admin/team-squads',
        {
          actorUserId: 'master',
          teamCode: 'CCC',
          teamName: 'CCC',
          tournamentType: 'tournament',
          tournamentId: tournamentBId,
          tournament: `Player Edit B ${tag}`,
          squad: [{ name: originalName, country: 'south africa', role: 'BAT', active: true }],
        },
        201,
      )

      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Squad Manager' }).click()

      const scopeSelects = page.locator('.manual-scope-row').first().locator('select')
      await scopeSelects.nth(0).selectOption('tournament')
      await scopeSelects.nth(1).selectOption(tournamentBId)
      await scopeSelects.nth(2).selectOption('CCC')

      const row = page.locator('.catalog-table tbody tr').first()
      await row.locator('input[placeholder="Player name"]').fill(updatedName)
      await page.getByRole('button', { name: 'Save squad' }).click()
      await expect(page.getByText('Squad saved')).toBeVisible()

      const globalPlayers = await apiCall(request, 'GET', '/players', undefined, 200)
      const matchesUpdated = (globalPlayers || []).filter((player) => {
        const name = (
          player.displayName ||
          player.name ||
          [player.firstName, player.lastName].filter(Boolean).join(' ')
        )
          .toString()
          .trim()
        return name === updatedName
      })
      expect(matchesUpdated).toHaveLength(1)

      const tournamentASquads = await apiCall(
        request,
        'GET',
        `/admin/team-squads?tournamentId=${tournamentAId}&teamCode=AAA`,
        undefined,
        200,
      )
      const tournamentBSquads = await apiCall(
        request,
        'GET',
        `/admin/team-squads?tournamentId=${tournamentBId}&teamCode=CCC`,
        undefined,
        200,
      )
      expect(tournamentASquads[0]?.squad?.some((player) => player.name === updatedName)).toBe(true)
      expect(tournamentBSquads[0]?.squad?.some((player) => player.name === updatedName)).toBe(true)
    } finally {
      await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentAId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
      await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentBId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })
})
