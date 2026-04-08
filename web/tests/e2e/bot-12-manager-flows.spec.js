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

const formatCountryLabel = (value = '') =>
  value
    .toString()
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')

const addPlayersFromSquadModal = async (page, entries) => {
  await page.getByRole('button', { name: 'Add player' }).click()
  const modal = page.locator('.squad-player-picker-modal')
  await expect(modal).toBeVisible()
  for (const entry of entries) {
    const name = typeof entry === 'string' ? entry : entry.name
    const country = typeof entry === 'string' ? '' : entry.country || ''
    if (country) {
      await modal.locator('select').first().selectOption(country)
    }
    await modal.getByPlaceholder('Search player catalog').fill(name)
    const row = modal.locator('.squad-player-picker-row', { hasText: name }).first()
    await expect(row).toBeVisible()
    if (country) {
      await expect(row).toContainText(formatCountryLabel(country))
    }
    await row.locator('input[type="checkbox"]').check()
    await expect(modal.getByText(`Selected:`, { exact: false })).toContainText(name)
  }
  await modal.getByRole('button', { name: 'Add selected players' }).click()
}

const enablePlayerManagerEditMode = async (page) => {
  const panel = page.locator('.player-manager-panel')
  await expect(panel).toBeVisible()
  const editButton = panel.getByRole('button', { name: 'Edit' })
  if (await editButton.count()) {
    await editButton.click()
    await expect(panel.getByRole('button', { name: 'Done' })).toBeVisible()
  }
}

const openScorecardsTabIfPresent = async (page) => {
  const scorecardsTab = page.getByRole('tab', { name: 'Scorecards' })
  if (await scorecardsTab.count()) {
    await scorecardsTab.click()
  }
}

const enableSquadManagerEditMode = async (page) => {
  const doneButton = page.getByRole('button', { name: 'Done' })
  if ((await doneButton.count()) === 0) {
    await page.getByRole('button', { name: 'Edit squad' }).click()
  }
  await expect
    .poll(async () => page.getByRole('tab', { name: 'JSON' }).count(), { timeout: 15000 })
    .toBeGreaterThan(0)
}

test.describe('12) Squad manager + tournament manager flows', () => {
  test.setTimeout(180000)

  test('json upload endpoints validate payloads and score upload hides excel tab', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-validation-${tag}`

    await apiCall(
      request,
      'POST',
      '/admin/tournaments',
      {
        actorUserId: 'master',
        tournamentId,
        name: `JSON Validation ${tag}`,
        season: '2026',
        source: 'json',
        selectedTeams: ['AAA', 'BBB'],
        matches: [
          {
            id: 'm1',
            matchNo: 1,
            home: 'AAA',
            away: 'BBB',
            startAt: '2099-03-10T14:00:00.000Z',
          },
        ],
      },
      201,
    )

    const invalidPlayerImport = await request.fetch(`${E2E_API_BASE}/admin/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: {
        actorUserId: 'master',
        players: [{ name: `Missing Country ${tag}`, role: 'BAT' }],
      },
    })
    expect(invalidPlayerImport.status()).toBe(400)
    expect(await invalidPlayerImport.json()).toMatchObject({
      message: 'players[0] country/nationality is required',
    })

    const invalidSquadImport = await request.fetch(`${E2E_API_BASE}/admin/team-squads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: {
        actorUserId: 'master',
        tournamentId,
        teamSquads: [
          {
            teamCode: 'AAA',
            squad: [{ name: `Missing Role ${tag}`, country: 'india' }],
          },
        ],
      },
    })
    expect(invalidSquadImport.status()).toBe(400)
    expect(await invalidSquadImport.json()).toMatchObject({
      message: 'teamSquads[0].squad[0] role is required',
    })

    const invalidAuctionImport = await request.fetch(
      `${E2E_API_BASE}/admin/auctions/import`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          actorUserId: 'master',
          tournamentId,
          contestName: `Auction ${tag}`,
          participants: [{ userId: `u-${tag}`, roster: [] }],
        },
      },
    )
    expect(invalidAuctionImport.status()).toBe(400)
    expect(await invalidAuctionImport.json()).toMatchObject({
      message: 'participants[0].roster must contain at least one player',
    })

    const invalidTournamentImport = await request.fetch(
      `${E2E_API_BASE}/admin/tournaments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          actorUserId: 'master',
          tournamentId: `bad-${tag}`,
          name: `Bad Tournament ${tag}`,
          season: '2026',
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'AAA',
              away: 'AAA',
              startAt: '2099-03-10T14:00:00.000Z',
            },
          ],
        },
      },
    )
    expect(invalidTournamentImport.status()).toBe(400)
    expect(await invalidTournamentImport.json()).toMatchObject({
      message: 'Matches must include valid teams',
    })

    await loginUi(page, 'master')
    await page.goto('/home?panel=upload')
    await openScorecardsTabIfPresent(page)
    await expect(page.getByRole('tab', { name: 'Excel Upload' })).toHaveCount(0)
    await expect(page.locator('.upload-tab-row')).not.toContainText('Excel Upload')
  })

  test('squad manager manual + json save stays in sync after refresh', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `squad-manual-${tag}`
    const tournamentName = `Squad Manual ${tag}`
    const teamName = `Mock E2E PSL Team ${tag}`
    const teamCode = buildTeamCodeFromName(teamName)
    const playerOne = `mocke2ebot-player-1-${tag}`
    const playerTwo = `mocke2ebot-player-2-${tag}`

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
          country: 'pakistan',
          league: 'PSL',
          selectedTeams: [teamCode],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: teamCode,
              away: 'OPP',
              startAt: '2099-03-10T14:00:00.000Z',
              timezone: 'Asia/Karachi',
              venue: 'Karachi',
            },
          ],
        },
        201,
      )

      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Player Manager' }).click()
      await enablePlayerManagerEditMode(page)

      await page.getByRole('button', { name: 'Add player' }).click()
      let modal = page.locator('.player-manager-create-modal')
      await modal.getByLabel('Name').fill(playerOne)
      await modal.getByLabel('Country').selectOption('pakistan')
      await modal.getByLabel('Role').selectOption('BAT')
      await modal
        .getByLabel('Image URL')
        .fill(`https://images.example.com/${playerOne}.png`)
      await modal.getByRole('button', { name: 'Add player' }).click()
      await expect(page.getByText('Player saved')).toBeVisible()

      await page.getByRole('button', { name: 'Add player' }).click()
      modal = page.locator('.player-manager-create-modal')
      await modal.getByLabel('Name').fill(playerTwo)
      await modal.getByLabel('Country').selectOption('australia')
      await modal.getByLabel('Role').selectOption('BOWL')
      await modal.getByRole('button', { name: 'Add player' }).click()
      await expect(page.getByText('Player saved')).toBeVisible()

      await page.goto('/home')
      await page.getByRole('button', { name: 'Squad Manager' }).click()
      await enableSquadManagerEditMode(page)

      const scopeRow = page.locator('.manual-scope-row').first()
      const scopeSelects = scopeRow.locator('select')
      await expect(scopeSelects).toHaveCount(1)
      await expect(scopeRow).not.toContainText('Type')
      await expect(scopeRow).not.toContainText('Country')
      await expect(scopeRow).not.toContainText('League')
      await scopeSelects.nth(0).selectOption(tournamentId)
      await expect(scopeSelects).toHaveCount(2)
      await scopeSelects.nth(1).selectOption(teamCode)

      await addPlayersFromSquadModal(page, [
        { name: playerOne, country: 'pakistan' },
        { name: playerTwo, country: 'australia' },
      ])

      await page.getByRole('button', { name: 'Save squad' }).click()
      await expect(page.getByText('Squad saved')).toBeVisible()

      const savedManual = await apiCall(
        request,
        'GET',
        `/admin/team-squads?teamCode=${teamCode}`,
        undefined,
        200,
      )
      expect(savedManual[0]?.teamCode).toBe(teamCode)
      expect(savedManual[0]?.squad?.length).toBe(2)
      expect(savedManual[0]?.squad?.[0]?.imageUrl).toBe(
        `https://images.example.com/${playerOne}.png`,
      )
      expect(
        savedManual[0]?.squad?.some((player) => player.country === 'australia'),
      ).toBe(true)

      await page.reload()
      await page.getByRole('button', { name: 'Squad Manager' }).click()
      await enableSquadManagerEditMode(page)
      await scopeSelects.nth(0).selectOption(tournamentId)
      await expect(scopeSelects).toHaveCount(2)
      await scopeSelects.nth(1).selectOption(teamCode)
      await expect(page.getByText(playerOne)).toBeVisible()
      await expect(page.getByText(playerTwo)).toBeVisible()

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
          {
            name: `mocke2ebot-player-3-${tag}`,
            country: 'pakistan',
            role: 'AR',
            active: true,
          },
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
      expect(
        savedJson[0]?.squad?.some((p) => p.name === `mocke2ebot-player-3-${tag}`),
      ).toBe(true)
    } finally {
      try {
        await request.fetch(`${E2E_API_BASE}/admin/team-squads/${teamCode}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master', tournamentId },
        })
      } catch {
        // best effort cleanup
      }
      try {
        await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      } catch {
        // best effort cleanup
      }
    }
  })

  test('tournament manager separates manage and create flows and loads matches from the selected tournament', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home?panel=tournamentManager')

    await expect(page.getByRole('tab', { name: 'Manage' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Create' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Manage' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    const tournamentSelect = page
      .locator('.admin-manager-tournament-selector-row select')
      .first()
    await expect(tournamentSelect).toBeVisible()
    const optionTexts = await tournamentSelect.locator('option').allTextContents()
    expect(optionTexts.some((text) => text.includes('IPL 2026'))).toBe(true)

    const iplOption = optionTexts.find((text) => text.includes('IPL 2026'))
    await tournamentSelect.selectOption({ label: iplOption })
    await expect(page.getByRole('heading', { name: 'Matches • IPL 2026' })).toBeVisible()
    await expect(
      page.locator('.admin-manager-matches-pane .catalog-table tbody tr').first(),
    ).toBeVisible()
    const sectionHeight = await page
      .locator('.dashboard-panel-view .dashboard-section')
      .first()
      .evaluate((node) => {
        return window.getComputedStyle(node).height
      })
    expect(sectionHeight).not.toBe('auto')

    await page.getByRole('tab', { name: 'Create' }).click()
    await expect(page.getByRole('heading', { name: 'Create tournament' })).toBeVisible()
    await expect(page.getByText('Create Tournament / Teams')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Manual' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'JSON' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Auction' })).toBeVisible()
  })

  test('player manager adds and deletes a global player via multi-select modal', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const playerName = `Player Manager ${tag}`
    let createdPlayerId = null

    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Player Manager' }).click()
    await enablePlayerManagerEditMode(page)

    await page.getByRole('button', { name: 'Add player' }).click()
    const modal = page.locator('.player-manager-create-modal')
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: 'Add player' }).click()
    await expect(page.getByText('Name, country, and role are required.')).toBeVisible()

    await modal.getByLabel('Name').fill(playerName)
    await modal.getByLabel('Country').selectOption('india')
    await modal.getByLabel('Role').selectOption('BAT')
    await modal.getByLabel('Image URL').fill(`https://images.example.com/${tag}.png`)
    await modal.getByRole('button', { name: 'Add player' }).click()
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
    await row.getByRole('checkbox', { name: `Select player ${playerName}` }).click()
    await page.getByRole('button', { name: 'Delete selected (1)' }).click()

    const deleteModal = page.locator('.player-manager-delete-modal')
    await expect(deleteModal).toBeVisible()
    await expect(deleteModal.getByText(playerName)).toBeVisible()
    await deleteModal.getByRole('button', { name: 'Delete players' }).click()

    const playersAfterDelete = await apiCall(request, 'GET', '/players', undefined, 200)
    expect(
      (playersAfterDelete || []).some(
        (row) => String(row.id) === String(createdPlayerId),
      ),
    ).toBe(false)
  })

  test('player manager country dropdown includes extended associate nations', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home?panel=players')
    await enablePlayerManagerEditMode(page)

    await page.getByRole('button', { name: 'Add player' }).click()
    const modal = page.locator('.player-manager-create-modal')
    await expect(modal).toBeVisible()

    const countryOptions = await modal
      .getByLabel('Country')
      .locator('option')
      .allTextContents()
    expect(countryOptions).toContain('USA')
    expect(countryOptions).toContain('UAE')
    expect(countryOptions).toContain('Netherlands')
    expect(countryOptions).toContain('Nepal')
  })

  test('player manager JSON import and squad manager JSON mapping populate tournament squads', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-map-${tag}`
    const canonicalPlayerId = `player-json-${tag}`
    const playerName = `JSON Import Player ${tag}`

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON Mapping ${tag}`,
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
      const invalidImport = await request.fetch(`${E2E_API_BASE}/admin/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          actorUserId: 'master',
          players: [
            {
              id: `missing-country-${tag}`,
              name: `Missing Country ${tag}`,
              role: 'BAT',
            },
          ],
        },
      })
      expect(invalidImport.status()).toBe(400)

      await apiCall(
        request,
        'POST',
        '/admin/players',
        {
          actorUserId: 'master',
          players: [
            {
              id: canonicalPlayerId,
              name: playerName,
              nationality: 'USA',
              role: 'BAT',
              player_img: `https://images.example.com/${canonicalPlayerId}.png`,
            },
          ],
        },
        201,
      )

      const duplicateImport = await request.fetch(`${E2E_API_BASE}/admin/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: {
          actorUserId: 'master',
          players: [
            {
              id: `${canonicalPlayerId}-duplicate`,
              name: playerName.toUpperCase(),
              nationality: 'usa',
              role: 'BAT',
            },
          ],
        },
      })
      expect(duplicateImport.status()).toBe(400)
      expect(await duplicateImport.json()).toMatchObject({
        message: `Player already exists: ${playerName.toUpperCase()} (usa)`,
      })

      await apiCall(
        request,
        'POST',
        '/admin/team-squads',
        {
          actorUserId: 'master',
          tournamentId,
          tournament: `JSON Mapping ${tag}`,
          country: 'india',
          league: 'IPL',
          teamSquads: [
            {
              teamCode: 'CSK',
              teamName: 'Chennai Super Kings',
              squad: [{ canonicalPlayerId }],
            },
          ],
        },
        201,
      )

      await page.goto('/home?panel=squads')
      await enableSquadManagerEditMode(page)
      const scopeSelects = page.locator('.manual-scope-row').first().locator('select')
      await scopeSelects.nth(0).selectOption(tournamentId)
      await expect(scopeSelects).toHaveCount(2)
      await scopeSelects.nth(1).selectOption('CSK')
      await expect(page.getByText(playerName)).toBeVisible()
    } finally {
      await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('squad manager json mode shows api errors and uses a larger textarea', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home?panel=squads')
    await enableSquadManagerEditMode(page)
    await page.getByRole('tab', { name: 'JSON' }).click()

    const generateJsonButton = page.getByRole('button', { name: 'Generate JSON' })
    await expect(generateJsonButton).toBeVisible()

    const jsonTextarea = page.locator('.squad-manager-json-textarea')
    await expect(jsonTextarea).toBeVisible()
    await generateJsonButton.click()
    await expect(jsonTextarea).toContainText('"teamSquads": [')

    const textareaHeight = await jsonTextarea.evaluate((node) => {
      return window.getComputedStyle(node).minHeight
    })
    expect(parseFloat(textareaHeight)).toBeGreaterThanOrEqual(300)

    await jsonTextarea.fill(
      JSON.stringify(
        {
          teamSquads: [
            {
              teamCode: 'CSK',
              squad: [
                {
                  name: 'Broken Import Player',
                  country: 'india',
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    )

    await page.getByRole('button', { name: 'Save squad' }).click()
    await expect(page.locator('.squad-manager-error')).toHaveText(
      'teamSquads[0].tournamentId or tournament is required',
    )
  })

  test('squad manager success notice uses success color after save', async ({ page }) => {
    const tag = Date.now()
    await page.route('**/admin/team-squads', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, importedCount: 1 }),
      })
    })
    await page.route('**/admin/team-squads?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            teamCode: 'AAA',
            teamName: 'AAA',
            tournamentId,
            tournament: `Readonly Squad ${tag}`,
            squad: [
              {
                canonicalPlayerId: `player-${tag}`,
                name: `Readonly Player ${tag}`,
                country: 'india',
                role: 'BAT',
                imageUrl: '',
                active: true,
              },
            ],
          },
        ]),
      })
    })

    await loginUi(page, 'master')
    await page.goto('/home?panel=squads')
    await enableSquadManagerEditMode(page)
    await page.getByRole('tab', { name: 'JSON' }).click()

    await page.locator('.squad-manager-json-textarea').fill(
      JSON.stringify(
        {
          tournamentId: `squad-success-${tag}`,
          tournament: `Squad Success ${tag}`,
          country: 'india',
          league: 'IPL',
          teamSquads: [
            {
              teamCode: 'CSK',
              teamName: 'Chennai Super Kings',
              tournamentId: `squad-success-${tag}`,
              tournament: `Squad Success ${tag}`,
              squad: [
                {
                  name: `Success Keeper ${tag}`,
                  country: 'india',
                  role: 'WK',
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    )

    await page.getByRole('button', { name: 'Save squad' }).click()
    const successNotice = page.locator('.squad-manager-success')
    await expect(successNotice).toHaveText('Squad saved')
    const successColor = await successNotice.evaluate(
      (node) => window.getComputedStyle(node).color,
    )
    expect(successColor).toBe('rgb(21, 128, 61)')
  })

  test('mobile squad manager uses compact columns and bulk remove without row remove button', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `squad-mobile-${tag}`
    const tournamentName = `Squad Mobile ${tag}`
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
          selectedTeams: ['SMT'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'SMT',
              away: 'AAA',
              startAt: '2099-03-10T14:00:00.000Z',
              timezone: 'UTC',
              venue: 'Mumbai',
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
          teamCode: 'SMT',
          teamName: 'Squad Mobile Team',
          tournamentType: 'tournament',
          tournamentId,
          tournament: tournamentName,
          country: 'india',
          league: 'IPL',
          source: 'manual',
          squad: [
            {
              name: `Mobile Player A ${tag}`,
              country: 'india',
              role: 'BAT',
              active: true,
            },
            {
              name: `Mobile Player B ${tag}`,
              country: 'india',
              role: 'BOWL',
              active: true,
            },
            {
              name: `Mobile Player C ${tag}`,
              country: 'india',
              role: 'AR',
              active: true,
            },
          ],
        },
        201,
      )

      await page.setViewportSize({ width: 390, height: 844 })
      await loginUi(page, 'master')
      await page.goto('/home?panel=squads')
      await enableSquadManagerEditMode(page)

      await page
        .locator('.dashboard-shell.panel-squads label', { hasText: 'Tournament' })
        .locator('select')
        .selectOption(tournamentId)
      await page
        .locator('.dashboard-shell.panel-squads label', { hasText: 'Team' })
        .locator('select')
        .selectOption('SMT')

      const squadTable = page.locator('.squad-manager-table')
      await expect(squadTable).toContainText(`Mobile Player A ${tag}`)
      await expect(squadTable.getByRole('button', { name: 'Remove' })).toHaveCount(0)
      await expect(squadTable.locator('thead th', { hasText: '#' })).toHaveCount(0)
      await expect(squadTable.locator('thead th', { hasText: /Active/i })).toHaveCount(0)

      await squadTable.getByLabel(`Select Mobile Player A ${tag}`).check()
      await squadTable.getByLabel(`Select Mobile Player B ${tag}`).check()
      await page.getByRole('button', { name: /Remove selected \(2\)/ }).click()

      await expect(squadTable).not.toContainText(`Mobile Player A ${tag}`)
      await expect(squadTable).not.toContainText(`Mobile Player B ${tag}`)
      await expect(squadTable).toContainText(`Mobile Player C ${tag}`)
    } finally {
      await request
        .fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
        .catch(() => {})
    }
  })

  test('dashboard json areas clear after successful save', async ({ page }) => {
    const tag = Date.now()

    await page.route('**/admin/tournaments', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          tournament: {
            id: `json-clear-${tag}`,
            name: `JSON Clear ${tag}`,
            matchesCount: 1,
          },
        }),
      })
    })
    await page.route('**/admin/team-squads', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        })
        return
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, importedCount: 1 }),
      })
    })
    await page.route('**/admin/team-squads?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await loginUi(page, 'master')

    await page.goto('/home?panel=createTournament')
    await page.getByRole('tab', { name: 'JSON' }).click()
    const tournamentJson = page.locator('.dashboard-json-textarea').first()
    await tournamentJson.fill(
      JSON.stringify(
        {
          tournamentId: `json-clear-${tag}`,
          name: `JSON Clear ${tag}`,
          season: '2026',
          source: 'json',
          selectedTeams: ['AAA', 'BBB'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'AAA',
              away: 'BBB',
              startAt: '2099-03-10T14:00:00.000Z',
            },
          ],
        },
        null,
        2,
      ),
    )
    await page.getByRole('button', { name: 'Save tournament' }).click()
    await expect(page.getByText(`Tournament created: JSON Clear ${tag}`)).toBeVisible()
    await expect(tournamentJson).toHaveValue('')

    await page.goto('/home?panel=squads')
    await enableSquadManagerEditMode(page)
    await page.getByRole('tab', { name: 'JSON' }).click()
    const squadJson = page.locator('.squad-manager-json-textarea')
    await squadJson.fill(
      JSON.stringify(
        {
          tournamentId: `json-clear-${tag}`,
          tournament: `JSON Clear ${tag}`,
          teamSquads: [
            {
              teamCode: 'CSK',
              tournamentId: `json-clear-${tag}`,
              tournament: `JSON Clear ${tag}`,
              squad: [
                {
                  name: `JSON Squad Player ${tag}`,
                  country: 'india',
                  role: 'WK',
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    )
    await page.getByRole('button', { name: 'Save squad' }).click()
    await expect(page.getByText('Squad saved')).toBeVisible()
    await expect(squadJson).toHaveValue('')
  })

  test('dashboard panel query param keeps player manager selected after reload', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Player Manager' }).click()

    await expect(page).toHaveURL(/\/home\?panel=players$/)
    await expect(page.locator('.player-manager-panel .catalog-table')).toBeVisible()

    const playerManagerLayout = await page
      .locator('.player-manager-panel')
      .evaluate((node) => {
        const panelStyle = window.getComputedStyle(node)
        const wrap = node.querySelector('.catalog-table-wrap')
        const wrapStyle = wrap ? window.getComputedStyle(wrap) : null
        return {
          panelOverflow: panelStyle.overflow,
          wrapOverflowY: wrapStyle?.overflowY || '',
        }
      })
    expect(playerManagerLayout.panelOverflow).toBe('hidden')
    expect(['auto', 'scroll']).toContain(playerManagerLayout.wrapOverflowY)

    await page.reload()

    await expect(page).toHaveURL(/\/home\?panel=players$/)
    await expect(page.locator('.player-manager-panel .catalog-table')).toBeVisible()
  })

  test('mobile dashboard selector includes master routes without separate shortcut row', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await loginUi(page, 'master')
    await page.goto('/home?panel=tournamentManager')

    const mobileSelect = page.locator('#dashboard-panel-select')
    await expect(mobileSelect).toBeVisible()
    await expect(page.getByRole('link', { name: 'All pages' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'All APIs' })).toHaveCount(0)

    const optionTexts = await mobileSelect.locator('option').allTextContents()
    expect(optionTexts).toContain('Admin • Tournament Manager')
    expect(optionTexts).toContain('Admin • Contest Manager')
    expect(optionTexts).toContain('Master • User Manager')
    expect(optionTexts).toContain('Master • All Pages')
    expect(optionTexts).toContain('Master • All APIs')
    await expect(mobileSelect.locator('optgroup')).toHaveCount(0)
  })

  test('dashboard nav buttons keep panel query params in sync across manager sections', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')

    await page.getByRole('button', { name: 'Scoring Rules' }).click()
    await expect(page).toHaveURL(/\/home\?panel=points$/)

    await page.getByRole('button', { name: 'Squad Manager' }).click()
    await expect(page).toHaveURL(/\/home\?panel=squads$/)

    await page.getByRole('button', { name: 'User Manager' }).click()
    await expect(page).toHaveURL(/\/home\?panel=userManager$/)

    await page.getByRole('button', { name: 'Tournament Manager' }).click()
    await expect(page).toHaveURL(/\/home\?panel=tournamentManager$/)

    await page.getByRole('button', { name: 'Contest Manager' }).click()
    await expect(page).toHaveURL(/\/home\?panel=contestManager$/)

    await page.getByRole('button', { name: 'Score Manager' }).click()
    await expect(page).toHaveURL(/\/home\?panel=upload$/)

    await page.getByRole('button', { name: 'Audit Logs' }).click()
    await expect(page).toHaveURL(/\/home\?panel=audit$/)
  })

  test('manager split keeps contest and tournament actions accessible', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Contest Manager' }).click()
    await expect(page.locator('.contest-section-head select').first()).toBeVisible()
    const contestRow = page.locator('.catalog-table tbody tr', {
      hasText: 'Huntercherry Contest',
    })
    await expect(contestRow).toBeVisible()
    await expect(contestRow.getByRole('button', { name: 'Delete' })).toBeVisible()
    await contestRow.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Delete contest "Huntercherry Contest"?')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Delete contest "Huntercherry Contest"?')).toHaveCount(0)

    await page.getByRole('button', { name: 'Tournament Manager' }).click()
    const tournamentRow = page.locator('.catalog-table tbody tr', {
      hasText: 'T20 World Cup 2026',
    })
    await expect(tournamentRow).toBeVisible()
    await expect(tournamentRow.getByRole('button', { name: 'Delete' })).toBeVisible()
    await expect(tournamentRow.locator('input[type="checkbox"]')).toBeVisible()
    await expect(tournamentRow.getByRole('button', { name: 'Disable' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete selected' })).toHaveCount(0)
  })

  test('contest manager auto-selects a tournament with contests and shows existing contest rows', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home?panel=contestManager')

    await expect(page.getByRole('heading', { name: 'Contest Manager' })).toBeVisible()
    const tournamentSelect = page.locator('.contest-section-head select').first()
    await expect(tournamentSelect).toBeVisible()
    await expect
      .poll(async () => tournamentSelect.locator('option').count())
      .toBeGreaterThan(0)
    await expect(page.locator('.catalog-table').first()).toBeVisible()
    await expect(
      page
        .locator('.catalog-table tbody tr', { hasText: 'Huntercherry Contest' })
        .first(),
    ).toBeVisible()
  })

  test('score manager context API returns tournament and match options for manual score operations', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    const context = await page.evaluate(async () => {
      const api = await import('/src/lib/api.js')
      return api.fetchManualScoreContext()
    })

    expect(Array.isArray(context?.tournaments)).toBe(true)
    expect(Array.isArray(context?.matches)).toBe(true)
    expect(context.tournaments.some((item) => item.name?.includes('IPL 2026'))).toBe(true)
    expect(context.matches.length).toBeGreaterThan(0)
  })

  test('score manager manual playing xi view renders team grids without crashing', async ({
    page,
  }) => {
    const pageErrors = []
    page.on('pageerror', (error) => {
      pageErrors.push(String(error))
    })

    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()

    await expect(page.locator('.match-scores-section')).toBeVisible()
    await page.getByRole('tab', { name: 'Playing XI' }).click()
    await page.getByRole('tab', { name: 'Manual Entry' }).click()
    await expect(page.getByText('Playing XI Entry')).toBeVisible()

    const tournamentSelect = page.locator('.manual-scope-row select').nth(0)
    const matchSelect = page.locator('.manual-scope-row select').nth(1)

    await tournamentSelect.selectOption({ index: 1 })
    await expect
      .poll(async () => matchSelect.locator('option').count())
      .toBeGreaterThan(1)
    await matchSelect.selectOption({ index: 1 })

    await expect(page.locator('.manual-lineup-layout .manual-lineup-card')).toHaveCount(2)
    await expect(page.locator('.manual-lineup-layout .manual-team-table')).toHaveCount(2)
    await expect(page.locator('.manual-lineup-layout .manual-team-meta')).toHaveCount(2)
    await expect(
      page.locator('.manual-lineup-layout .manual-team-meta').first(),
    ).toContainText('players')
    expect(pageErrors).toEqual([])
  })

  test('score manager generated score modal shows AI prompt and json mode action uses Save label', async ({
    page,
    request,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()

    await expect(page.locator('.match-scores-section')).toBeVisible()
    await openScorecardsTabIfPresent(page)
    await page.getByRole('tab', { name: 'JSON Upload' }).click()

    const tournamentSelect = page.locator('.manual-scope-row select').nth(0)
    const matchSelect = page.locator('.manual-scope-row select').nth(1)
    await tournamentSelect.selectOption({ index: 1 })
    await expect
      .poll(async () => matchSelect.locator('option').count(), { timeout: 15000 })
      .toBeGreaterThan(1)
    await matchSelect.selectOption({ index: 1 })

    const tournamentId = await tournamentSelect.inputValue()
    const matchId = await matchSelect.inputValue()
    const teamPool = await apiCall(
      request,
      'GET',
      `/team-pool?tournamentId=${encodeURIComponent(tournamentId)}&matchId=${encodeURIComponent(matchId)}&userId=master`,
      undefined,
      200,
    )
    const teamAName = (teamPool?.teams?.teamA?.name || '').toString().trim()
    const teamBName = (teamPool?.teams?.teamB?.name || '').toString().trim()
    const teamASquad = (teamPool?.teams?.teamA?.players || [])
      .map((player) => (player?.name || '').toString().trim())
      .filter(Boolean)
    const teamBSquad = (teamPool?.teams?.teamB?.players || [])
      .map((player) => (player?.name || '').toString().trim())
      .filter(Boolean)

    await apiCall(
      request,
      'POST',
      '/admin/match-lineups/upsert',
      {
        actorUserId: 'master',
        tournamentId,
        matchId,
        lineups: {
          [teamAName]: {
            squad: teamASquad,
            playingXI: teamASquad.slice(0, 11),
            bench: teamASquad.slice(11),
          },
          [teamBName]: {
            squad: teamBSquad,
            playingXI: teamBSquad.slice(0, 11),
            bench: teamBSquad.slice(11),
          },
        },
      },
      200,
    )

    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()
    await expect(page.locator('.match-scores-section')).toBeVisible()
    await openScorecardsTabIfPresent(page)
    await page.getByRole('tab', { name: 'JSON Upload' }).click()
    await tournamentSelect.selectOption(tournamentId)
    await expect
      .poll(async () => matchSelect.locator('option').count(), { timeout: 15000 })
      .toBeGreaterThan(1)
    await matchSelect.selectOption(matchId)
    const alternativeMatchId = await matchSelect
      .locator('option')
      .evaluateAll((options, current) => {
        const values = options
          .map((option) => option.value)
          .filter((value) => value && value !== current)
        return values[0] || null
      }, matchId)
    if (alternativeMatchId) {
      await matchSelect.selectOption(alternativeMatchId)
      await matchSelect.selectOption(matchId)
    }

    const playingXiTab = page.getByRole('tab', { name: 'Playing XI' })
    if (await playingXiTab.count()) {
      await playingXiTab.click()
      await openScorecardsTabIfPresent(page)
      await page.getByRole('tab', { name: 'JSON Upload' }).click()
    }

    const actionRow = page.locator('.upload-head-actions.upload-actions-row').first()
    await expect(actionRow.getByRole('button', { name: 'Save' })).toBeVisible()
    await expect(actionRow.getByRole('button', { name: 'Upload JSON' })).toHaveCount(0)

    await actionRow.getByRole('button', { name: 'Generate JSON' }).click()
    const scoreModal = page.locator('.score-preview-modal', {
      has: page.getByRole('heading', { name: 'Generated Score JSON' }),
    })
    await expect(scoreModal).toBeVisible()
    await expect(scoreModal.getByText('AI Prompt For Live Scoring')).toBeVisible()
    await expect(scoreModal.getByRole('button', { name: 'Copy AI Prompt' })).toBeVisible()
    await expect(scoreModal.locator('.score-preview-textarea-prompt')).toContainText(
      '/match-scores/save',
    )
  })

  test('playing xi generated json modal shows reusable AI prompt and inline copy controls', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()

    await expect(page.locator('.match-scores-section')).toBeVisible()
    await page.getByRole('tab', { name: 'Playing XI' }).click()
    await page.getByRole('tab', { name: 'JSON Upload' }).click()

    const tournamentSelect = page.locator('.manual-scope-row select').nth(0)
    const matchSelect = page.locator('.manual-scope-row select').nth(1)
    await tournamentSelect.selectOption({ index: 1 })
    await expect
      .poll(async () => matchSelect.locator('option').count(), { timeout: 15000 })
      .toBeGreaterThan(1)
    await matchSelect.selectOption({ index: 1 })

    const actionRow = page.locator('.upload-head-actions.upload-actions-row').first()
    await actionRow.getByRole('button', { name: 'Generate JSON' }).click()

    const lineupModal = page.locator('.score-preview-modal', {
      has: page.getByRole('heading', { name: 'Generated Playing XI JSON' }),
    })
    await expect(lineupModal).toBeVisible()
    await expect(lineupModal.getByText('AI Prompt For Playing XI JSON')).toBeVisible()
    await expect(lineupModal.getByRole('button', { name: 'Copy JSON' })).toBeVisible()
    await expect(
      lineupModal.getByRole('button', { name: 'Copy AI Prompt' }),
    ).toBeVisible()
    await expect(lineupModal.locator('.score-preview-textarea-prompt')).toContainText(
      '/admin/match-lineups/upsert',
    )
  })

  test('score manager clears json upload textarea after successful save', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()

    await expect(page.locator('.match-scores-section')).toBeVisible()
    await openScorecardsTabIfPresent(page)

    const tournamentSelect = page.locator('.manual-scope-row select').nth(0)
    const matchSelect = page.locator('.manual-scope-row select').nth(1)
    await tournamentSelect.selectOption({ index: 1 })
    await expect
      .poll(async () => matchSelect.locator('option').count(), { timeout: 15000 })
      .toBeGreaterThan(1)
    await matchSelect.selectOption({ index: 1 })

    await page.getByRole('tab', { name: 'Manual Entry' }).click()
    const firstPlayerName = (
      (await page
        .locator('.manual-entry-grid .manual-team-card .player-identity-name')
        .first()
        .textContent()) || ''
    ).trim()
    expect(firstPlayerName.length).toBeGreaterThan(0)

    await page.getByRole('tab', { name: 'JSON Upload' }).click()

    const payloadTextarea = page
      .locator('.match-upload-grid.json-mode .match-upload-json textarea')
      .first()
    const payload = {
      playerStats: [
        {
          playerName: firstPlayerName,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          wickets: 0,
          overs: 0,
          maidens: 0,
          runsConceded: 0,
          noBalls: 0,
          wides: 0,
          catches: 0,
          stumpings: 0,
          runoutDirect: 0,
          runoutIndirect: 0,
          dismissed: false,
        },
      ],
    }
    await payloadTextarea.fill(JSON.stringify(payload, null, 2))

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Match scores payload saved')).toBeVisible()
    await expect(payloadTextarea).toHaveValue('')
  })

  test('score manager json upload has clear button for large payload text', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()

    await expect(page.locator('.match-scores-section')).toBeVisible()
    await openScorecardsTabIfPresent(page)
    await page.getByRole('tab', { name: 'JSON Upload' }).click()

    const payloadTextarea = page
      .locator('.match-upload-grid.json-mode .match-upload-json textarea')
      .first()
    await payloadTextarea.fill(
      '{\n  "playerStats": [{"playerName": "Large Payload Test"}]\n}',
    )
    await expect(payloadTextarea).not.toHaveValue('')

    const clearButton = page
      .locator('.match-upload-grid.json-mode .match-upload-json .json-textarea-actions')
      .getByRole('button', { name: 'Clear' })
    await expect(clearButton).toBeVisible()
    await clearButton.click()

    await expect(payloadTextarea).toHaveValue('')
  })

  test('score manager normalizes AI-formatted json payload before save', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()

    await expect(page.locator('.match-scores-section')).toBeVisible()
    await openScorecardsTabIfPresent(page)

    const tournamentSelect = page.locator('.manual-scope-row select').nth(0)
    const matchSelect = page.locator('.manual-scope-row select').nth(1)
    await tournamentSelect.selectOption({ index: 1 })
    await expect
      .poll(async () => matchSelect.locator('option').count(), { timeout: 15000 })
      .toBeGreaterThan(1)
    await matchSelect.selectOption({ index: 1 })

    await page.getByRole('tab', { name: 'Manual Entry' }).click()
    const firstPlayerName = (
      (await page
        .locator('.manual-entry-grid .manual-team-card .player-identity-name')
        .first()
        .textContent()) || ''
    ).trim()
    expect(firstPlayerName.length).toBeGreaterThan(0)

    await page.getByRole('tab', { name: 'JSON Upload' }).click()

    const payloadTextarea = page
      .locator('.match-upload-grid.json-mode .match-upload-json textarea')
      .first()
    const payload = {
      playerStats: [
        {
          playerName: firstPlayerName,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          wickets: 0,
          overs: 0,
          maidens: 0,
          runsConceded: 0,
          noBalls: 0,
          wides: 0,
          catches: 0,
          stumpings: 0,
          runoutDirect: 0,
          runoutIndirect: 0,
          dismissed: false,
        },
      ],
    }
    const aiFormattedPayload = [
      '\u200BHere is your payload:',
      '```json',
      JSON.stringify(payload, null, 2).replace(/"/g, '“'),
      '```',
    ].join('\n')
    await payloadTextarea.fill(aiFormattedPayload)

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Match scores payload saved')).toBeVisible()
    await expect(payloadTextarea).toHaveValue('')
  })

  test('admin manager users table shows safe joined dates instead of invalid date text', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'User Manager' }).click()

    await expect(page.getByRole('heading', { name: 'User Manager' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Available users \(/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Pending users \(/ })).toBeVisible()
    await expect(
      page
        .locator(
          '.user-manager-layout .user-manager-primary .admin-manager-panel .catalog-table',
        )
        .first(),
    ).toBeVisible()
    await expect(
      page
        .locator('.user-manager-layout .user-manager-secondary .pending-approvals-panel')
        .first(),
    ).toBeVisible()
    await expect(page.getByText('Invalid Date')).toHaveCount(0)
  })

  test('user manager asks confirmation before deleting a user', async ({ page }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'User Manager' }).click()

    await expect(page.getByRole('heading', { name: 'User Manager' })).toBeVisible()

    const userTableRows = page.locator('.admin-manager-panel .catalog-table tbody tr')
    const deletableRow = userTableRows
      .filter({
        has: page.locator('button:has-text("Delete"):not([disabled])'),
      })
      .first()

    await expect(deletableRow).toBeVisible()
    const userLabel = (
      (await deletableRow.locator('td').first().textContent()) || ''
    ).trim()

    await deletableRow.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { name: 'Delete user' })).toBeVisible()
    await expect(page.getByText('Delete user')).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'Delete user' })).toHaveCount(0)
    if (userLabel) {
      await expect(
        page.locator('.admin-manager-panel .catalog-table tbody tr', {
          hasText: userLabel,
        }),
      ).toHaveCount(1)
    }
  })

  test('tournament manager lets admins update match status for a selected tournament', async ({
    page,
  }) => {
    const tag = Date.now()
    const tournamentName = `Match Status ${tag}`
    const tournamentId = normalizeTournamentId(tournamentName)

    try {
      await loginUi(page, 'master')
      await page.evaluate(
        async ({ nextTournamentId, nextTournamentName }) => {
          const api = await import('/src/lib/api.js')
          await api.createAdminTournament({
            actorUserId: 'master',
            tournamentId: nextTournamentId,
            name: nextTournamentName,
            season: '2026',
            source: 'json',
            tournamentType: 'league',
            country: 'india',
            league: 'IPL',
            selectedTeams: ['RCB', 'SRH'],
            matches: [
              {
                id: 'm1',
                matchNo: 1,
                home: 'RCB',
                away: 'SRH',
                startAt: '2099-03-10T14:00:00.000Z',
                timezone: 'Asia/Kolkata',
                venue: 'Bengaluru',
              },
            ],
          })
        },
        { nextTournamentId: tournamentId, nextTournamentName: tournamentName },
      )
      await page.goto('/home')
      await page.getByRole('button', { name: 'Tournament Manager' }).click()

      const tournamentRow = page
        .locator('.catalog-table tbody tr', { hasText: tournamentName })
        .first()
      await expect(tournamentRow).toBeVisible()
      await tournamentRow.click()
      await expect(tournamentRow).toHaveClass(/active/)

      await expect(
        page.getByRole('heading', { name: `Matches • ${tournamentName}` }),
      ).toBeVisible()
      const matchesTable = page.locator('.catalog-table').nth(1)
      await expect(matchesTable).toContainText('RCB')
      await expect(matchesTable).toContainText('SRH')
      await expect(matchesTable).toContainText('Not Started')

      const statusSelect = page.getByLabel(/Match status/i).first()
      await statusSelect.selectOption('completed')
      await expect(page.getByText('Match status updated')).toBeVisible()
      await expect(matchesTable).toContainText('Completed')
    } finally {
      await page
        .evaluate(
          async ({ nextTournamentId }) => {
            const api = await import('/src/lib/api.js')
            const rows = await api.fetchTournamentCatalog()
            const target = (rows || []).find((row) => row.sourceKey === nextTournamentId)
            if (target?.id) {
              await api.deleteAdminTournament({ id: target.id, actorUserId: 'master' })
            }
          },
          { nextTournamentId: tournamentId },
        )
        .catch(() => {})
    }
  })

  test('mobile home navigation resets dashboard back to the main panel', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await loginUi(page, 'master')
    await page.goto('/home')

    await page.locator('#dashboard-panel-select').selectOption('userManager')
    await expect(page.getByRole('heading', { name: 'User Manager' })).toBeVisible()

    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await page.getByRole('link', { name: 'Home' }).click()

    await expect(page).toHaveURL(/\/home\?panel=joined$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.locator('.mobile-nav-drawer')).not.toHaveClass(/open/)
  })

  test('mobile nav shows admin panel links for master and hides them for player', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await expect(
      page.getByRole('link', { name: 'Admin • Tournament Manager' }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Admin • Contest Manager' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Admin • Squad Manager' })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Admin • Playing XI Manager' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Admin • Score Manager' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Admin • Audit Logs' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Master • User Manager' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Master • All Pages' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Master • All APIs' })).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).click()

    await loginUi(page, 'player')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await expect(
      page.getByRole('link', { name: 'Admin • Tournament Manager' }),
    ).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Admin • Contest Manager' })).toHaveCount(
      0,
    )
    await expect(page.getByRole('link', { name: 'Admin • Squad Manager' })).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Admin • Playing XI Manager' }),
    ).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Admin • Score Manager' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Admin • Audit Logs' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Master • User Manager' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Master • All Pages' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Master • All APIs' })).toHaveCount(0)
  })

  test('short wide dashboard view hides the left sidebar and uses the compact panel selector', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1524, height: 554 })
    await loginUi(page, 'master')
    await page.goto('/home?panel=contestManager')

    await expect(page.getByRole('heading', { name: 'Contest Manager' })).toBeVisible()
    await expect(page.locator('.dashboard-left-nav')).toBeHidden()
    await expect(page.locator('.dashboard-mobile-panel-select')).toBeVisible()
    await expect(page.locator('#dashboard-panel-select')).toBeVisible()
  })

  test('squad manager manual flow is tournament-first and hides legacy scope selectors', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `squad-scope-${tag}`
    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `Squad Scope ${tag}`,
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

      const scopeRow = page.locator('.manual-scope-row').first()
      const scopeSelects = scopeRow.locator('select')
      await expect(scopeSelects).toHaveCount(1)
      await expect(scopeRow).not.toContainText('Type')
      await expect(scopeRow).not.toContainText('Country')
      await expect(scopeRow).not.toContainText('League')
      await scopeSelects.nth(0).selectOption(tournamentId)
      await expect(scopeSelects).toHaveCount(2)
      await scopeSelects.nth(1).selectOption('CSK')

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
      await expect(scopeSelects).toHaveCount(1)
      await scopeSelects.nth(0).selectOption(tournamentId)
      await expect(scopeSelects).toHaveCount(2)
      await scopeSelects.nth(1).selectOption('CSK')

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
      await enableSquadManagerEditMode(page)
      await page.getByRole('tab', { name: 'JSON' }).click()
      await page.locator('.squad-manager-json-textarea').fill(
        JSON.stringify(
          {
            tournamentId,
            tournament: tournamentName,
            teamSquads: [
              {
                teamCode: 'AAA',
                teamName: 'AAA',
                tournamentId,
                tournament: tournamentName,
                squad: [
                  {
                    name: 'Spencer Johnson',
                    country: 'australia',
                    role: 'BOWL',
                    active: true,
                  },
                ],
              },
            ],
          },
          null,
          2,
        ),
      )
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

      const fallbackStyles = await page
        .locator('.player-avatar-fallback')
        .first()
        .evaluate((node) => {
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
      await enablePlayerManagerEditMode(page)
      await page.getByRole('button', { name: 'Add player' }).click()
      const modal = page.locator('.player-manager-create-modal')
      await modal.getByLabel('Name').fill(playerName)
      await modal.getByLabel('Country').selectOption('south africa')
      await modal.getByLabel('Role').selectOption('BAT')
      await modal.getByRole('button', { name: 'Add player' }).click()
      await expect(page.getByText('Player saved')).toBeVisible()

      await page.goto('/home')
      await page.getByRole('button', { name: 'Squad Manager' }).click()
      await enableSquadManagerEditMode(page)

      const scopeSelects = page.locator('.manual-scope-row').first().locator('select')
      await expect(scopeSelects).toHaveCount(1)
      await scopeSelects.nth(0).selectOption(tournamentAId)
      await expect(scopeSelects).toHaveCount(2)
      await scopeSelects.nth(1).selectOption('AAA')
      await expect(page.getByText('No players')).toBeVisible()
      await addPlayersFromSquadModal(page, [
        { name: playerName, country: 'south africa' },
      ])
      await page.getByRole('button', { name: 'Save squad' }).click()
      await expect(page.getByText('Squad saved')).toBeVisible()

      const playersAfterFirstSave = await apiCall(
        request,
        'GET',
        '/players',
        undefined,
        200,
      )
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

      await scopeSelects.nth(0).selectOption(tournamentBId)
      await expect(scopeSelects).toHaveCount(2)
      await scopeSelects.nth(1).selectOption('CCC')

      await expect(page.getByText('No players')).toBeVisible()
      await addPlayersFromSquadModal(page, [
        { name: playerName, country: 'south africa' },
      ])
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

  test('player and squad managers are read-only by default until admin enables edit mode', async ({
    page,
  }) => {
    const tag = Date.now()
    const tournamentId = `readonly-squad-${tag}`

    await page.route('**/players', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: `player-${tag}`,
            name: `Readonly Player ${tag}`,
            country: 'india',
            role: 'BAT',
            imageUrl: '',
          },
        ]),
      })
    })
    await page.route('**/admin/tournaments/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: tournamentId,
            name: `Readonly Squad ${tag}`,
            country: 'india',
            league: 'IPL',
            selectedTeams: ['AAA', 'BBB'],
          },
        ]),
      })
    })
    await page.route('**/admin/team-squads?**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await loginUi(page, 'master')
    await page.goto('/home?panel=players')
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add player' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'JSON import' })).toHaveCount(0)

    await enablePlayerManagerEditMode(page)
    await expect(page.getByRole('button', { name: 'Add player' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'JSON import' })).toBeVisible()

    await page.goto('/home?panel=squads')
    await expect(page.getByRole('button', { name: 'Edit squad' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save squad' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add player' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'JSON' })).toHaveCount(0)

    const manualTable = page.locator('.catalog-table').first()
    await expect(manualTable).not.toContainText('IMAGE URL')

    await enableSquadManagerEditMode(page)
    await expect(page.getByRole('button', { name: 'Save squad' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'JSON' })).toBeVisible()

    const scopeSelects = page.locator('.manual-scope-row').first().locator('select')
    await expect(scopeSelects).toHaveCount(1)
    await scopeSelects.nth(0).selectOption(tournamentId)
    await expect(scopeSelects).toHaveCount(2)
    const teamOptionTexts = await scopeSelects.nth(1).locator('option').allTextContents()
    expect(teamOptionTexts).not.toContain('+ New team')
    await scopeSelects.nth(1).selectOption('AAA')
    await expect(page.getByRole('button', { name: 'Add player' })).toBeVisible()
  })

  test('regular users can open player manager in read-only mode', async ({ page }) => {
    const tag = Date.now()

    await page.route('**/players', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: `player-${tag}`,
            name: `Visible Player ${tag}`,
            country: 'india',
            role: 'BAT',
            imageUrl: '',
          },
        ]),
      })
    })

    await loginUi(page, 'player')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Player Manager' }).click()
    await expect(page).toHaveURL(/\/home\?panel=players$/)
    await expect(page.getByText(`Visible Player ${tag}`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add player' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'JSON import' })).toHaveCount(0)
  })

  test('fantasy contest cards show remaining time for scheduled starts', async ({
    page,
  }) => {
    const tag = Date.now()
    const startAt = new Date(
      Date.now() + ((3 * 24 + 3) * 60 + 22) * 60 * 1000,
    ).toISOString()

    await page.route('**/admin/tournaments/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'ipl-2026',
            name: 'IPL 2026',
            enabled: true,
          },
        ]),
      })
    })
    await page.route('**/contests?game=Fantasy**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: `contest-${tag}`,
            tournamentId: 'ipl-2026',
            name: `Countdown Contest ${tag}`,
            game: 'Fantasy',
            mode: 'standard',
            status: 'Starting Soon',
            teams: 20,
            maxPlayers: 20,
            joinedCount: 0,
            hasCapacity: true,
            joinOpen: true,
            startAt,
          },
        ]),
      })
    })

    await loginUi(page, 'master')
    await page.goto('/fantasy')
    const card = page
      .locator('.compact-contest-card', { hasText: `Countdown Contest ${tag}` })
      .first()
    await expect(card).toBeVisible()
    await expect(card.locator('.contest-countdown')).toContainText('remaining')
  })

  test('admin can manually start a scheduled fantasy contest and close joins', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `contest-start-window-${tag}`
    const tournamentName = `Contest Start ${tag}`
    const contestName = `Start Window Contest ${tag}`

    try {
      await loginUi(page, 'master')
      await page.evaluate(
        async ({
          tournamentId: nextTournamentId,
          tournamentName: nextTournamentName,
        }) => {
          const api = await import('/src/lib/api.js')
          await api.createAdminTournament({
            actorUserId: 'master',
            tournamentId: nextTournamentId,
            name: nextTournamentName,
            season: '2026',
            source: 'json',
            selectedTeams: ['AAA', 'BBB'],
            matches: [
              {
                id: 'm1',
                matchNo: 1,
                home: 'AAA',
                away: 'BBB',
                startAt: '2099-03-10T14:00:00.000Z',
              },
            ],
          })
        },
        { tournamentId, tournamentName },
      )
      await page.evaluate(
        async ({ nextTournamentId, nextContestName }) => {
          const api = await import('/src/lib/api.js')
          await api.createAdminContest({
            actorUserId: 'master',
            tournamentId: nextTournamentId,
            name: nextContestName,
            game: 'Fantasy',
            mode: 'standard',
            maxParticipants: 20,
            startAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            matchIds: ['m1'],
          })
        },
        { nextTournamentId: tournamentId, nextContestName: contestName },
      )

      const beforeStartContests = await page.evaluate(async () => {
        const api = await import('/src/lib/api.js')
        return api.fetchContests({ game: 'Fantasy', userId: 'master' })
      })
      const beforeStartContest = (beforeStartContests || []).find(
        (row) => row.name === contestName,
      )
      expect(beforeStartContest?.status).toBe('Starting Soon')
      expect(beforeStartContest?.joinOpen).toBe(true)

      await page.goto('/home')
      await page.getByRole('button', { name: 'Admin Manager' }).click()
      await page.getByRole('tab', { name: 'Contests' }).click()
      await page
        .locator('.contest-section-head select')
        .selectOption({ label: tournamentName })
      const contestRow = page
        .locator('.catalog-table tbody tr', { hasText: contestName })
        .first()
      await expect(contestRow).toContainText('Starting Soon')
      await expect(contestRow.getByRole('button', { name: 'Start now' })).toBeVisible()
      await page.evaluate(
        async ({ nextContestName }) => {
          const api = await import('/src/lib/api.js')
          const rows = await api.fetchContestCatalog()
          const target = (rows || []).find((row) => row.name === nextContestName)
          if (!target?.id) throw new Error('Contest not found in catalog')
          await api.startAdminContest(target.id, 'master')
        },
        { nextContestName: contestName },
      )
      await page
        .locator('.contest-section-head button', { hasText: 'Refresh contests' })
        .click()

      const afterStartContests = await page.evaluate(async () => {
        const api = await import('/src/lib/api.js')
        return api.fetchContests({ game: 'Fantasy', userId: 'master' })
      })
      const afterStartContest = (afterStartContests || []).find(
        (row) => row.name === contestName,
      )
      expect(afterStartContest?.status).toBe('In Progress')
      expect(afterStartContest?.joinOpen).toBe(false)
    } finally {
      try {
        await page.evaluate(
          async ({ nextTournamentId }) => {
            const api = await import('/src/lib/api.js')
            await api.deleteAdminTournament({
              id: nextTournamentId,
              actorUserId: 'master',
            })
          },
          { nextTournamentId: tournamentId },
        )
      } catch {
        // best effort cleanup
      }
    }
  })
})
