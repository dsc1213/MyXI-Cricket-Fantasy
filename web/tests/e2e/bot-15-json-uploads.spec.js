import { expect, test } from '@playwright/test'
import {
  apiCall,
  createContest,
  deleteContestIfPresent,
  loginUi,
} from './helpers/mock-e2e.js'

const buildTeamCode = (tag) => `J${String(tag).slice(-5)}`
const MASTER_LOGIN =
  process.env.PW_E2E_MASTER_LOGIN || process.env.PW_DB_MASTER_LOGIN || 'master'

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

  return selected.map((player) => player.id)
}

const createTournamentViaApi = async ({ request, tournamentId, name }) =>
  apiCall(
    request,
    'POST',
    '/admin/tournaments',
    {
      actorUserId: 'master',
      tournamentId,
      name,
      season: '2026',
      source: 'json',
      matches: [
        {
          id: 'm1',
          matchNo: 1,
          home: 'LQ',
          away: 'IU',
          date: '2099-03-10',
          startAt: '2099-03-10T14:00:00.000Z',
          venue: 'Karachi',
        },
        {
          id: 'm2',
          matchNo: 2,
          home: 'KK',
          away: 'PZ',
          date: '2099-03-11',
          startAt: '2099-03-11T14:00:00.000Z',
          venue: 'Lahore',
        },
      ],
    },
    201,
  )

test.describe('15) JSON uploads and UI validation', () => {
  test.setTimeout(180000)

  test('score manager json mode exposes generated score JSON modal', async ({ page }) => {
    await loginUi(page, MASTER_LOGIN)
    await page.goto('/home?panel=upload')

    const scorecardsTab = page.getByRole('tab', { name: 'Scorecards' })
    await expect(scorecardsTab).toBeVisible()
    await scorecardsTab.click()

    const jsonUploadTab = page.getByRole('tab', { name: 'JSON Upload' })
    await expect(jsonUploadTab).toBeVisible()
    await jsonUploadTab.click()

    const selects = page.locator('.manual-scope-row select')
    await selects.nth(0).selectOption('ipl-2026')
    await selects.nth(1).selectOption('ipl-m1')

    await page.getByRole('tab', { name: 'Playing XI' }).click()
    await page.getByRole('tab', { name: 'Manual Entry' }).click()
    const lineupCards = page.locator('.manual-lineup-card')
    await expect(lineupCards).toHaveCount(2)
    for (let cardIndex = 0; cardIndex < 2; cardIndex += 1) {
      const card = lineupCards.nth(cardIndex)
      const toggles = card.locator('tbody input[type="checkbox"]')
      const total = await toggles.count()
      for (let idx = 0; idx < total; idx += 1) {
        const selectedCount = await card
          .locator('tbody input[type="checkbox"]:checked')
          .count()
        if (selectedCount >= 11) break
        const toggle = toggles.nth(idx)
        if (!(await toggle.isChecked())) {
          await toggle.click()
        }
      }
      await expect(card.locator('tbody input[type="checkbox"]:checked')).toHaveCount(11)
    }
    await page.getByRole('button', { name: 'Save Playing XI' }).click()
    await expect(page.getByText('Playing XI saved')).toBeVisible()
    await page.reload()
    await page.goto('/home?panel=upload')
    await page.getByRole('tab', { name: 'Playing XI' }).click()
    await page.getByRole('tab', { name: 'Manual Entry' }).click()
    const refreshedSelects = page.locator('.manual-scope-row select')
    await refreshedSelects.nth(0).selectOption('ipl-2026')
    await refreshedSelects.nth(1).selectOption('ipl-m1')
    const refreshedCards = page.locator('.manual-lineup-card')
    await expect(refreshedCards).toHaveCount(2)
    for (let cardIndex = 0; cardIndex < 2; cardIndex += 1) {
      await expect(
        refreshedCards.nth(cardIndex).locator('tbody input[type="checkbox"]:checked'),
      ).toHaveCount(11)
    }

    await page.getByRole('tab', { name: 'Scorecards' }).click()
    await page.getByRole('tab', { name: 'JSON Upload' }).click()

    await expect(page.getByRole('link', { name: 'Download sample JSON' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Generate JSON' }).click()
    const generatedDialog = page.getByRole('dialog', { name: 'Generated score JSON' })
    await expect(generatedDialog).toBeVisible()
    await expect(generatedDialog.locator('.score-preview-textarea')).toContainText(
      '"playerStats"',
    )
    await expect(page.getByRole('button', { name: 'Copy JSON' })).toBeVisible()
    await generatedDialog.getByRole('button', { name: 'Close' }).click()
    await expect(generatedDialog).toBeHidden()
  })

  test('score manager manual mode exposes save action without scorecard sample link', async ({
    page,
  }) => {
    await loginUi(page, MASTER_LOGIN)
    await page.goto('/home?panel=upload')

    const scorecardsTab = page.getByRole('tab', { name: 'Scorecards' })
    await expect(scorecardsTab).toBeVisible()
    await scorecardsTab.click()

    const manualEntryTab = page.getByRole('tab', { name: 'Manual Entry' })
    await expect(manualEntryTab).toBeVisible()
    await manualEntryTab.click()

    await expect(page.getByRole('link', { name: 'Download sample JSON' })).toHaveCount(0)

    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
  })

  test('player manager import modal generates JSON beside input area', async ({
    page,
  }) => {
    await loginUi(page, MASTER_LOGIN)
    await page.goto('/home?panel=players')

    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('button', { name: 'JSON import' }).click()

    const modal = page.locator('.player-manager-import-modal')
    await expect(modal).toBeVisible()

    await modal.getByRole('button', { name: 'Generate JSON' }).click()
    await expect(modal.getByText('Generated JSON')).toBeVisible()
    await expect(modal.locator('.player-manager-generated-json')).toContainText(
      '"players"',
    )
  })

  test('player manager edit mode allows renaming a player row', async ({
    page,
    request,
  }) => {
    const tag = `${Date.now()}`
    const originalName = `Edit Player ${tag}`
    const updatedName = `Edited Player ${tag}`

    await apiCall(
      request,
      'POST',
      '/admin/players',
      {
        actorUserId: 'master',
        name: originalName,
        country: 'india',
        role: 'BAT',
      },
      201,
    )

    await loginUi(page, MASTER_LOGIN)
    await page.goto('/home?panel=players')
    await page.getByPlaceholder('Filter players').fill(originalName)
    await page.getByRole('button', { name: 'Edit' }).click()

    const row = page.locator('tbody tr', { hasText: originalName }).first()
    await expect(row).toBeVisible()
    await row.getByLabel(`Player name ${originalName}`).fill(updatedName)
    await row.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Player updated')).toBeVisible()

    await page.reload()
    await page.goto('/home?panel=players')
    await page.getByPlaceholder('Filter players').fill(updatedName)
    await expect(page.locator('tbody tr', { hasText: updatedName }).first()).toBeVisible()
  })

  test('canonical player identity survives tournament unlink and avoids duplicate player rows', async ({
    page,
  }) => {
    await loginUi(page, 'master')

    const tag = `${Date.now()}`
    const canonicalName = `Canonical Brevis ${tag}`
    const tournamentAJson = await page.evaluate(
      async ({ tag: innerTag }) => {
        const api = await import('/src/lib/api.js')
        return api.createAdminTournament({
          actorUserId: 'master',
          tournamentId: `canon-a-${innerTag}`,
          name: `Canonical A ${innerTag}`,
          season: '2026',
          source: 'json',
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'CSK',
              away: 'MI',
              date: '2099-04-01',
              startAt: '2099-04-01T14:00:00.000Z',
            },
          ],
        })
      },
      { tag },
    )
    expect(tournamentAJson?.tournament?.id).toBeTruthy()

    const tournamentBJson = await page.evaluate(
      async ({ tag: innerTag }) => {
        const api = await import('/src/lib/api.js')
        return api.createAdminTournament({
          actorUserId: 'master',
          tournamentId: `canon-b-${innerTag}`,
          name: `Canonical B ${innerTag}`,
          season: '2026',
          source: 'json',
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'SA',
              away: 'AUS',
              date: '2099-04-02',
              startAt: '2099-04-02T14:00:00.000Z',
            },
          ],
        })
      },
      { tag },
    )
    expect(tournamentBJson?.tournament?.id).toBeTruthy()

    const saveSquad = async (payload) => {
      const response = await page.evaluate(async (innerPayload) => {
        const api = await import('/src/lib/api.js')
        return api.upsertAdminTeamSquad(innerPayload)
      }, payload)
      expect(response?.ok).toBeTruthy()
    }

    await saveSquad({
      actorUserId: 'master',
      teamCode: 'CSK',
      teamName: 'Chennai Super Kings',
      tournamentType: 'tournament',
      tournamentId: tournamentAJson.tournament.id,
      tournament: `Canonical A ${tag}`,
      squad: [
        { name: canonicalName, country: 'south africa', role: 'BAT', active: true },
      ],
    })

    await saveSquad({
      actorUserId: 'master',
      teamCode: 'SA',
      teamName: 'South Africa',
      tournamentType: 'tournament',
      tournamentId: tournamentBJson.tournament.id,
      tournament: `Canonical B ${tag}`,
      squad: [
        { name: canonicalName, country: 'south africa', role: 'BAT', active: true },
      ],
    })

    const players = await page.evaluate(async () => {
      const api = await import('/src/lib/api.js')
      return api.fetchPlayers()
    })
    const brevisRows = (Array.isArray(players) ? players : []).filter((item) => {
      const name = (
        item.displayName ||
        item.name ||
        [item.firstName, item.lastName].filter(Boolean).join(' ')
      )
        .toString()
        .trim()
        .toLowerCase()
      return name === canonicalName.toLowerCase()
    })
    expect(brevisRows).toHaveLength(1)

    await page.evaluate(
      async ({ teamCode, tournamentId }) => {
        const api = await import('/src/lib/api.js')
        return api.deleteAdminTeamSquad({ teamCode, actorUserId: 'master', tournamentId })
      },
      { teamCode: 'CSK', tournamentId: tournamentAJson.tournament.id },
    )

    const playersAfterDelete = await page.evaluate(async () => {
      const api = await import('/src/lib/api.js')
      return api.fetchPlayers()
    })
    const brevisRowsAfterDelete = (
      Array.isArray(playersAfterDelete) ? playersAfterDelete : []
    ).filter((item) => {
      const name = (
        item.displayName ||
        item.name ||
        [item.firstName, item.lastName].filter(Boolean).join(' ')
      )
        .toString()
        .trim()
        .toLowerCase()
      return name === canonicalName.toLowerCase()
    })
    expect(brevisRowsAfterDelete).toHaveLength(1)
  })

  test('scoring rules panel falls back to default rules and saves global rules', async ({
    page,
  }) => {
    let capturedSaveBody = null
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'myxi-user',
        JSON.stringify({
          id: 1,
          userId: 'master',
          gameName: 'master',
          role: 'master_admin',
          token: 'e2e-token',
          tokenExpiresAt: Date.now() + 60 * 60 * 1000,
          status: 'active',
        }),
      )
    })

    await page.route('**/page-load-data', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tournaments: [
            {
              id: 9991,
              name: 'Fallback Rules Tournament',
              season: '2026',
              status: 'active',
            },
          ],
          joinedContests: [],
          pointsRuleTemplate: {},
          adminManager: [],
          masterConsole: [],
          auditLogs: [],
          source: 'db',
        }),
      })
    })

    await page.route('**/contests**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route('**/scoring-rules/save', async (route) => {
      capturedSaveBody = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          tournamentId: capturedSaveBody?.tournamentId || null,
          rules: capturedSaveBody?.rules || {},
        }),
      })
    })

    await page.goto('/home')
    await page.getByRole('button', { name: 'Scoring Rules' }).click()

    await expect(page.getByText('Each Run')).toBeVisible()
    await expect(page.getByText('Each Wicket')).toBeVisible()
    await expect(page.getByText('Each Catch')).toBeVisible()

    await page.getByRole('button', { name: 'Edit' }).click()
    const firstRunInput = page
      .locator('.points-group')
      .filter({ hasText: 'batting' })
      .locator('input')
      .first()
    await firstRunInput.fill('2')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Scoring rules saved')).toBeVisible()
    expect(capturedSaveBody?.actorUserId).toBe('master')
    expect(capturedSaveBody?.tournamentId ?? null).toBe(null)
    expect(capturedSaveBody?.rules?.batting?.[0]?.value).toBe(2)
  })

  test('admin manager users tab tolerates wrapped admin users payload without crashing', async ({
    page,
  }) => {
    const pageErrors = []
    page.on('pageerror', (error) => {
      pageErrors.push(String(error))
    })

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'myxi-user',
        JSON.stringify({
          id: 1,
          userId: 'master',
          gameName: 'master',
          role: 'master_admin',
          token: 'e2e-token',
          tokenExpiresAt: Date.now() + 60 * 60 * 1000,
          status: 'active',
        }),
      )
    })

    await page.route('**/page-load-data', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tournaments: [],
          joinedContests: [],
          pointsRuleTemplate: {},
          adminManager: [],
          masterConsole: [],
          auditLogs: [],
          source: 'db',
        }),
      })
    })

    await page.route('**/admin/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            {
              id: 101,
              name: 'Wrapped User',
              userId: 'wrappeduser',
              gameName: 'wrappeduser',
              email: 'wrapped@myxi.local',
              role: 'user',
              status: 'active',
            },
          ],
        }),
      })
    })

    await page.route('**/admin/tournaments/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/home?panel=admin')
    await page.waitForTimeout(1000)
    expect(
      pageErrors.some((message) => message.includes('users.filter is not a function')),
    ).toBe(false)
  })

  test('admin manager tournament enable persists checked state after catalog reload', async ({
    page,
  }) => {
    let catalogRows = [
      {
        id: 'ipl-2026',
        name: 'IPL 2026',
        season: '2026',
        enabled: false,
        matchesCount: 74,
        contestsCount: 0,
        hasActiveContests: false,
        lastUpdatedAt: '2026-03-30T18:00:00.000Z',
      },
    ]

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'myxi-user',
        JSON.stringify({
          id: 1,
          userId: 'master',
          gameName: 'master',
          role: 'master_admin',
          token: 'e2e-token',
          tokenExpiresAt: Date.now() + 60 * 60 * 1000,
          status: 'active',
        }),
      )
    })

    await page.route('**/page-load-data', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tournaments: [],
          joinedContests: [],
          pointsRuleTemplate: {},
          adminManager: [],
          masterConsole: [],
          auditLogs: [],
          source: 'db',
        }),
      })
    })

    await page.route('**/admin/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route('**/admin/tournaments/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(catalogRows),
      })
    })

    await page.route('**/admin/tournaments/enable', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}')
      const enabledIds = Array.isArray(body?.ids) ? body.ids : []
      catalogRows = catalogRows.map((row) =>
        enabledIds.includes(row.id) ? { ...row, enabled: true } : row,
      )
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          tournaments: catalogRows.filter((row) => row.enabled),
        }),
      })
    })

    await page.goto('/home?panel=admin')
    await page.getByRole('tab', { name: /Tournaments \(1\)/ }).click()

    const row = page.locator('.catalog-table tbody tr', { hasText: 'IPL 2026' }).first()
    const checkbox = row.locator('input[type="checkbox"]')
    await expect(checkbox).not.toBeChecked()
    await expect(row).toContainText('Available')
    await expect(row).toContainText('74')

    await checkbox.check()
    await page.getByRole('button', { name: 'Add to Tournaments' }).click()

    await expect(page.getByText('Tournaments added')).toBeVisible()
    await expect(checkbox).toBeChecked()
    await expect(row).toContainText('Enabled')
  })

  test('pending approvals tolerates wrapped admin users payload without crashing', async ({
    page,
  }) => {
    const pageErrors = []
    page.on('pageerror', (error) => {
      pageErrors.push(String(error))
    })

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'myxi-user',
        JSON.stringify({
          id: 1,
          userId: 'master',
          gameName: 'master',
          role: 'master_admin',
          token: 'e2e-token',
          tokenExpiresAt: Date.now() + 60 * 60 * 1000,
          status: 'active',
        }),
      )
    })

    await page.route('**/page-load-data', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tournaments: [],
          joinedContests: [],
          pointsRuleTemplate: {},
          adminManager: [],
          masterConsole: [],
          auditLogs: [],
          source: 'db',
        }),
      })
    })

    await page.route('**/admin/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          users: [
            {
              id: 201,
              name: 'Pending Wrapped User',
              userId: 'pendingwrapped',
              gameName: 'pendingwrapped',
              email: 'pendingwrapped@myxi.local',
              role: 'user',
              status: 'pending',
            },
          ],
        }),
      })
    })

    await page.goto('/home?panel=approvals')
    await page.waitForTimeout(1000)
    expect(
      pageErrors.some((message) => message.includes('filter is not a function')),
    ).toBe(false)
    await expect(page.getByText('Pending Wrapped User')).toBeVisible()
  })

  test('fantasy and auction hubs show a single empty-state message when no tournaments are available', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'myxi-user',
        JSON.stringify({
          id: 7,
          userId: 'player7',
          gameName: 'player7',
          role: 'user',
          token: 'e2e-token',
          tokenExpiresAt: Date.now() + 60 * 60 * 1000,
          status: 'active',
        }),
      )
    })

    await page.route('**/tournaments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.route('**/contests**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/fantasy')
    await expect(page.getByText('No tournaments available')).toHaveCount(2)
    await expect(
      page.getByText(
        'Ask an admin to add a tournament to Fantasy, then it will appear here.',
      ),
    ).toBeVisible()

    await page.goto('/auction')
    await expect(page.getByText('No tournaments available')).toHaveCount(2)
    await expect(
      page.getByText(
        'Ask an admin to publish an auction tournament, then it will appear here.',
      ),
    ).toBeVisible()
  })

  test('squad JSON upload adds team players and appears in Squad Manager', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const teamCode = buildTeamCode(tag)
    const teamName = `JSON Upload Team ${tag}`

    try {
      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Squad Manager' }).click()
      await page.getByRole('tab', { name: 'JSON' }).click()

      const payload = {
        teamCode,
        teamName,
        tournamentType: 'league',
        country: 'pakistan',
        league: 'PSL',
        source: 'json',
        squad: [
          {
            name: `json-player-a-${tag}`,
            country: 'pakistan',
            role: 'BAT',
            active: true,
          },
          {
            name: `json-player-b-${tag}`,
            country: 'pakistan',
            role: 'BOWL',
            active: true,
          },
        ],
      }
      await page.locator('textarea').fill(JSON.stringify(payload, null, 2))
      await page.getByRole('button', { name: 'Save squad' }).click()
      await expect(page.getByText('Squad saved')).toBeVisible()

      await page.getByRole('tab', { name: 'Manual' }).click()
      const scope = page.locator('.manual-scope-row').first().locator('select')
      await scope.nth(0).selectOption('league')
      await scope.nth(1).selectOption('pakistan')
      await scope.nth(2).selectOption('PSL')
      await scope.nth(3).selectOption(teamCode)

      await expect(
        page.locator(`.catalog-table tbody input[value="json-player-a-${tag}"]`),
      ).toBeVisible()
      await expect(
        page.locator(`.catalog-table tbody input[value="json-player-b-${tag}"]`),
      ).toBeVisible()
    } finally {
      await request.fetch(`http://127.0.0.1:4000/admin/team-squads/${teamCode}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('tournament JSON upload appears in Admin Manager and Fantasy', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-tour-${tag}`
    const tournamentName = `JSON Tournament ${tag}`

    try {
      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Create Tournament' }).click()
      await page.getByRole('tab', { name: 'JSON' }).click()

      const payload = {
        name: tournamentName,
        season: '2026',
        tournamentId,
        source: 'json',
        tournamentType: 'league',
        country: 'pakistan',
        league: 'PSL',
        selectedTeams: ['LQ', 'IU', 'KK', 'PZ'],
        matches: [
          {
            id: 'm1',
            matchNo: 1,
            home: 'LQ',
            away: 'IU',
            startAt: '2099-03-10T14:00:00.000Z',
            venue: 'Karachi',
          },
          {
            id: 'm2',
            matchNo: 2,
            home: 'KK',
            away: 'PZ',
            startAt: '2099-03-11T14:00:00.000Z',
            venue: 'Lahore',
          },
        ],
      }
      await page.locator('textarea').fill(JSON.stringify(payload, null, 2))
      await page.getByRole('button', { name: 'Save tournament' }).click()
      await expect(page.getByText(`Tournament created: ${tournamentName}`)).toBeVisible()
      await expect(page.getByText('Tournament saved successfully.')).toBeVisible()
      await expect(page.getByText(`${tournamentName} • 2 matches imported`)).toBeVisible()
      await expect(
        page.locator('.dashboard-panel-card h3', { hasText: 'Create tournament' }),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Open Admin Manager' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Create Tournament' })).toHaveClass(
        /active/,
      )

      const catalog = await apiCall(
        request,
        'GET',
        '/admin/tournaments/catalog',
        undefined,
        200,
      )
      expect((catalog || []).some((row) => row.id === tournamentId)).toBe(true)

      await page.goto('/home')
      await page.getByRole('button', { name: 'Admin Manager' }).click()
      await page.getByRole('tab', { name: /Tournaments \(/ }).click()
      await expect(
        page.locator('.catalog-table tbody tr', { hasText: tournamentName }),
      ).toBeVisible()

      await page.goto('/fantasy')
      await expect(page.getByText(tournamentName)).toBeVisible()
    } finally {
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('auction tab defaults to the newly created tournament id for linked imports', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-auction-link-tour-${tag}`
    const tournamentName = `JSON Auction Link Tournament ${tag}`

    try {
      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Create Tournament' }).click()
      await page.getByRole('tab', { name: 'JSON' }).click()

      const payload = {
        name: tournamentName,
        season: '2026',
        tournamentId,
        source: 'json',
        tournamentType: 'league',
        country: 'india',
        league: 'IPL',
        selectedTeams: ['RCB', 'SRH', 'MI', 'KKR'],
        matches: [
          {
            id: 'm1',
            matchNo: 1,
            home: 'RCB',
            away: 'SRH',
            startAt: '2099-03-10T14:00:00.000Z',
            venue: 'Bengaluru',
          },
        ],
      }

      await page
        .locator('.dashboard-json-textarea')
        .fill(JSON.stringify(payload, null, 2))
      await page.getByRole('button', { name: 'Save tournament' }).click()
      await expect(page.getByText(`Tournament created: ${tournamentName}`)).toBeVisible()

      await page.getByRole('tab', { name: 'Auction' }).click()
      await expect(page.locator('.dashboard-json-textarea')).toContainText(
        `"tournamentId": "${tournamentId}"`,
      )
    } finally {
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('contest detail keeps started match 1 visible instead of excluding it', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-tour-started-${tag}`
    const tournamentName = `Started Match Tournament ${tag}`
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
          selectedTeams: ['RCB', 'SRH', 'MI', 'KKR'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'RCB',
              away: 'SRH',
              startAt: '2026-03-01T14:00:00.000Z',
              venue: 'Bengaluru',
            },
            {
              id: 'm2',
              matchNo: 2,
              home: 'MI',
              away: 'KKR',
              startAt: '2099-03-10T14:00:00.000Z',
              venue: 'Mumbai',
            },
          ],
        },
        201,
      )

      const createdContest = await createContest({
        request,
        tournamentId,
        name: `contest-started-${tag}`,
        teams: 20,
        createdBy: 'master',
      })
      contestId = createdContest.id

      await loginUi(page, 'master')
      await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)

      const matchFilter = page.getByRole('combobox').first()
      await expect(matchFilter).toHaveValue('all')
      await expect(page.locator('.match-table tbody tr')).toHaveCount(2)
      await expect(matchFilter.locator('option[value="all"]')).toHaveText('All (2)')
      const firstMatchRow = page.locator('.match-table tbody tr', { hasText: 'Match 1' })
      await expect(firstMatchRow).toBeVisible()
      await expect(firstMatchRow).toContainText('In Progress')
    } finally {
      await deleteContestIfPresent(request, contestId)
      try {
        await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      } catch {
        // best effort cleanup
      }
    }
  })

  test('contest detail keeps completed matches at the bottom while preserving date order', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-tour-sort-${tag}`
    const tournamentName = `Sorted Match Tournament ${tag}`
    let contestId = ''

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
            selectedTeams: ['RCB', 'SRH', 'MI', 'KKR', 'RR', 'CSK'],
            matches: [
              {
                id: 'm1',
                matchNo: 1,
                home: 'RCB',
                away: 'SRH',
                startAt: '2099-03-03T14:00:00.000Z',
                venue: 'Bengaluru',
              },
              {
                id: 'm2',
                matchNo: 2,
                home: 'MI',
                away: 'KKR',
                startAt: '2099-03-01T14:00:00.000Z',
                venue: 'Mumbai',
              },
              {
                id: 'm3',
                matchNo: 3,
                home: 'RR',
                away: 'CSK',
                startAt: '2099-03-02T14:00:00.000Z',
                venue: 'Jaipur',
              },
            ],
          })
        },
        { nextTournamentId: tournamentId, nextTournamentName: tournamentName },
      )

      contestId = await page.evaluate(
        async ({ targetTournamentId, innerTag }) => {
          const api = await import('/src/lib/api.js')
          const response = await api.createAdminContest({
            actorUserId: 'master',
            tournamentId: targetTournamentId,
            name: `contest-sort-${innerTag}`,
            game: 'Fantasy',
            mode: 'standard',
            maxParticipants: 20,
          })
          return response?.contest?.id || response?.id || ''
        },
        { targetTournamentId: tournamentId, innerTag: tag },
      )

      await page.route(`**/contests/${contestId}/matches**`, async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'm1',
              matchNo: 1,
              home: 'RCB',
              away: 'SRH',
              status: 'completed',
              startAt: '2099-03-03T14:00:00.000Z',
              hasTeam: false,
              submittedCount: 0,
              joinedCount: 0,
              viewerJoined: false,
            },
            {
              id: 'm2',
              matchNo: 2,
              home: 'MI',
              away: 'KKR',
              status: 'notstarted',
              startAt: '2099-03-01T14:00:00.000Z',
              hasTeam: false,
              submittedCount: 0,
              joinedCount: 0,
              viewerJoined: false,
            },
            {
              id: 'm3',
              matchNo: 3,
              home: 'RR',
              away: 'CSK',
              status: 'inprogress',
              startAt: '2099-03-02T14:00:00.000Z',
              hasTeam: false,
              submittedCount: 0,
              joinedCount: 0,
              viewerJoined: false,
            },
          ]),
        })
      })

      await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)

      const matchRows = page.locator('.match-table tbody tr')
      await expect(matchRows).toHaveCount(3)
      await expect(matchRows.nth(0)).toContainText('Match 2')
      await expect(matchRows.nth(1)).toContainText('Match 3')
      await expect(matchRows.nth(2)).toContainText('Match 1')
      await expect(matchRows.nth(2)).toContainText('Completed')
    } finally {
      await deleteContestIfPresent(request, contestId)
      try {
        await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      } catch {
        // best effort cleanup
      }
    }
  })

  test('contest detail tolerates wrapped matches payloads without crashing', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-tour-wrapped-${tag}`
    const tournamentName = `Wrapped Match Tournament ${tag}`
    let contestId = ''
    const pageErrors = []

    page.on('pageerror', (error) => {
      pageErrors.push(error.message || String(error))
    })

    try {
      await loginUi(page, 'master')
      await page.evaluate(
        async ({
          tournamentId: targetTournamentId,
          tournamentName: targetTournamentName,
        }) => {
          const api = await import('/src/lib/api.js')
          await api.createAdminTournament({
            actorUserId: 'master',
            tournamentId: targetTournamentId,
            name: targetTournamentName,
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
                startAt: '2099-03-01T14:00:00.000Z',
                venue: 'Bengaluru',
              },
            ],
          })
        },
        { tournamentId, tournamentName },
      )
      contestId = await page.evaluate(
        async ({ targetTournamentId, tag: innerTag }) => {
          const api = await import('/src/lib/api.js')
          const response = await api.createAdminContest({
            actorUserId: 'master',
            tournamentId: targetTournamentId,
            name: `contest-wrapped-${innerTag}`,
            game: 'Fantasy',
            mode: 'standard',
            status: 'Open',
            maxParticipants: 20,
          })
          return response?.contest?.id || response?.id || ''
        },
        { targetTournamentId: tournamentId, tag },
      )

      await page.route(`**/contests/${contestId}/matches**`, async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            matches: [
              {
                id: 'm1',
                matchNo: 1,
                home: 'RCB',
                away: 'SRH',
                status: 'notstarted',
                hasTeam: false,
                submittedCount: 0,
                joinedCount: 0,
                viewerJoined: false,
              },
            ],
          }),
        })
      })
      await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)

      await expect(page.locator('.match-table tbody tr')).toHaveCount(1)
      await expect(pageErrors).not.toContain(
        expect.stringContaining('matches.find is not a function'),
      )
    } finally {
      await deleteContestIfPresent(request, contestId)
      try {
        await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      } catch {
        // best effort cleanup
      }
    }
  })

  test('contest detail keeps loading note visible until initial matches load', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-tour-loading-${tag}`
    const tournamentName = `Loading Match Tournament ${tag}`
    let contestId = ''

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
                startAt: '2099-03-01T14:00:00.000Z',
                venue: 'Bengaluru',
              },
            ],
          })
        },
        { nextTournamentId: tournamentId, nextTournamentName: tournamentName },
      )
      contestId = await page.evaluate(
        async ({ targetTournamentId, innerTag }) => {
          const api = await import('/src/lib/api.js')
          const response = await api.createAdminContest({
            actorUserId: 'master',
            tournamentId: targetTournamentId,
            name: `contest-loading-${innerTag}`,
            game: 'Fantasy',
            mode: 'standard',
            maxParticipants: 20,
            matchIds: ['m1'],
          })
          return response?.contest?.id || response?.id || ''
        },
        { targetTournamentId: tournamentId, innerTag: tag },
      )

      await page.route(`**/contests/${contestId}/matches**`, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 700))
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'm1',
              matchNo: 1,
              home: 'RCB',
              away: 'SRH',
              status: 'notstarted',
              hasTeam: false,
              submittedCount: 0,
              joinedCount: 0,
              viewerJoined: false,
            },
          ]),
        })
      })

      await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)
      await expect(page.locator('.loading-note')).toBeVisible()
      await expect(page.locator('.match-table tbody tr')).toHaveCount(1)
      await expect(page.locator('.loading-note')).toHaveCount(0)
    } finally {
      await deleteContestIfPresent(request, contestId)
      try {
        await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      } catch {
        // best effort cleanup
      }
    }
  })

  test('contest detail row selection shows submitted participants and preview drawer for added teams', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-participants-${tag}`
    const tournamentName = `Participants Tournament ${tag}`
    let contestId = ''

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
            selectedTeams: ['KKR', 'PBKS'],
            matches: [
              {
                id: 'm12',
                matchNo: 12,
                home: 'KKR',
                away: 'PBKS',
                startAt: '2099-04-06T14:00:00.000Z',
                venue: 'Kolkata',
              },
            ],
          })
        },
        { nextTournamentId: tournamentId, nextTournamentName: tournamentName },
      )

      contestId = await page.evaluate(
        async ({ targetTournamentId, innerTag }) => {
          const api = await import('/src/lib/api.js')
          const response = await api.createAdminContest({
            actorUserId: 'master',
            tournamentId: targetTournamentId,
            name: `contest-participants-${innerTag}`,
            game: 'Fantasy',
            mode: 'standard',
            maxParticipants: 20,
            matchIds: ['m12'],
          })
          return response?.contest?.id || response?.id || ''
        },
        { targetTournamentId: tournamentId, innerTag: tag },
      )

      await page.evaluate(
        async ({ nextContestId }) => {
          const api = await import('/src/lib/api.js')
          await api.joinContest({ contestId: nextContestId, userId: 'master' })
        },
        { nextContestId: contestId },
      )

      const pool = await page.evaluate(
        async ({ nextContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.fetchTeamPool({
            contestId: nextContestId,
            matchId: 'm12',
            userId: 'master',
          })
        },
        { nextContestId: contestId },
      )
      const allPlayers = [
        ...(pool?.teams?.teamA?.players || []),
        ...(pool?.teams?.teamB?.players || []),
      ]
      expect(allPlayers.length).toBeGreaterThanOrEqual(11)

      await page.evaluate(
        async ({ nextContestId, xi, backups, captainId, viceCaptainId }) => {
          const api = await import('/src/lib/api.js')
          await api.saveTeamSelection({
            contestId: nextContestId,
            matchId: 'm12',
            userId: 'master',
            playingXi: xi,
            backups,
            captainId,
            viceCaptainId,
          })
        },
        {
          nextContestId: contestId,
          xi: allPlayers.slice(0, 11).map((player) => player.id),
          backups: allPlayers.slice(11, 14).map((player) => player.id),
          captainId: allPlayers[0]?.id,
          viceCaptainId: allPlayers[1]?.id,
        },
      )

      await page.goto(`/tournaments/${tournamentId}/contests/${contestId}`)

      const matchRow = page.locator('.match-table tbody tr').first()
      await expect(matchRow).toBeVisible()
      await expect(matchRow).toContainText('Added')

      await matchRow.click()
      await expect(page.locator('.participants-table tbody tr')).toHaveCount(1)
      await page.route('**/users/player/picks**', async (route) => {
        const response = await route.fetch()
        const payload = await response.json()
        const nextPicksDetailed = Array.isArray(payload?.picksDetailed)
          ? payload.picksDetailed.map((row, index) => ({
              ...row,
              lineupStatus: index === 0 ? 'bench' : 'playing',
            }))
          : []
        const nextBackupsDetailed = Array.isArray(payload?.backupsDetailed)
          ? payload.backupsDetailed.map((row) => ({
              ...row,
              lineupStatus: 'bench',
            }))
          : []
        await page.waitForTimeout(300)
        await route.fulfill({
          response,
          body: JSON.stringify({
            ...payload,
            picksDetailed: nextPicksDetailed,
            backupsDetailed: nextBackupsDetailed,
          }),
        })
      })
      await page
        .locator('.participants-table tbody tr')
        .first()
        .getByLabel(/View .* team/)
        .click()
      await expect(page.locator('.team-preview-drawer.open')).toBeVisible()
      await expect(page.getByText('Loading team preview...')).toBeVisible()
      await expect(
        page.locator('.team-preview-list').first().locator('.team-preview-row'),
      ).toHaveCount(11)
      await expect(
        page.locator('.team-preview-lineup-dot.lineup-status-light.playing').first(),
      ).toBeVisible()
      await expect(
        page.locator('.team-preview-lineup-dot.lineup-status-light.bench').first(),
      ).toBeVisible()
    } finally {
      await deleteContestIfPresent(request, contestId)
      try {
        await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      } catch {
        // best effort cleanup
      }
    }
  })

  test('auction upload panel shows the accepted mapped JSON contract', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Create Tournament' }).click()
    await page.getByRole('tab', { name: 'Auction' }).click()

    await expect(page.locator('.auction-json-help')).toContainText(
      'Accepted shape: tournamentId, contestName, and participants',
    )
    await expect(page.locator('.auction-json-help')).toContainText('userId')
    await expect(page.locator('.auction-json-help')).toContainText('name')
    await expect(page.locator('.auction-json-help')).toContainText('roster')
    await expect(page.locator('.auction-json-help')).toContainText(
      'api/scripts/build_auction_import.py',
    )
    await expect(page.locator('.dashboard-json-textarea')).toContainText('"participants"')
    await expect(page.locator('.dashboard-json-textarea')).toContainText('"contestName"')
  })

  test('auction JSON import creates a fixed-roster contest visible in Auction hub', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const contestName = `JSON Auction ${tag}`
    let createdContestId = ''

    try {
      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Create Tournament' }).click()
      await page.getByRole('tab', { name: 'Auction' }).click()

      const payload = {
        tournamentId: 'ipl-2026',
        contestName,
        participants: [
          {
            userId: 'huntercherryxi',
            name: 'HunterCherryXI',
            roster: ['Ruturaj Gaikwad', 'Tilak Varma', 'Harshal Patel'],
          },
          {
            userId: 'draker',
            name: 'Draker',
            roster: ['Heinrich Klaasen', 'Rajat Patidar', 'Yash Dayal'],
          },
        ],
      }

      await page
        .locator('.dashboard-json-textarea')
        .fill(JSON.stringify(payload, null, 2))
      await page.getByRole('button', { name: 'Import auction' }).click()
      await expect(page.getByText(`Auction imported: ${contestName}`)).toBeVisible()
      await expect(page.getByText('Auction saved successfully.')).toBeVisible()
      await expect(
        page.getByText(`${contestName} • 2 participants imported`),
      ).toBeVisible()

      await page.goto('/auction')
      const card = page.locator('.compact-contest-card', { hasText: contestName })
      await expect(card).toBeVisible()
      await expect(card).toContainText('2 participants')

      const catalog = await apiCall(
        request,
        'GET',
        '/admin/contests/catalog?tournamentId=ipl-2026',
        undefined,
        200,
      )
      const created = (catalog || []).find((row) => row.name === contestName)
      expect(created).toBeTruthy()
      expect(created?.mode).toBe('fixed_roster')
      createdContestId = created?.id || ''
    } finally {
      if (createdContestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${createdContestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
    }
  })

  test('auction JSON import shows inline API errors while keeping the loading state visible', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Create Tournament' }).click()
    await page.getByRole('tab', { name: 'Auction' }).click()

    await page.route('**/admin/auctions/import', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250))
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Tournament has no matches',
        }),
      })
    })

    await page.locator('.dashboard-json-textarea').fill(
      JSON.stringify(
        {
          tournamentId: 'ipl-2026',
          contestName: 'Broken Auction Import',
          participants: [
            {
              userId: 'captain-a',
              name: 'Captain A',
              roster: ['Ruturaj Gaikwad'],
            },
          ],
        },
        null,
        2,
      ),
    )
    await page.getByRole('button', { name: 'Import auction' }).click()

    await expect(page.getByText('Importing auction data...')).toBeVisible()
    await expect(page.locator('.create-tournament-inline-error')).toContainText(
      'Tournament has no matches',
    )
    await expect(page.getByText('Importing auction data...')).toHaveCount(0)
  })

  test('tournament JSON helper uses IPL example and admin headers stay readable in dark theme', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Create Tournament' }).click()
    await page.getByRole('tab', { name: 'JSON' }).click()

    const placeholder = await page
      .locator('.dashboard-json-textarea')
      .getAttribute('placeholder')
    expect(placeholder || '').toContain('"name": "IPL 2026"')
    expect(placeholder || '').toContain('"league": "IPL"')
    expect(placeholder || '').not.toContain('Pakistan Super League')
    expect(placeholder || '').not.toContain('"league": "PSL"')

    await page.evaluate(() => {
      window.localStorage.setItem('myxi-theme', 'dark')
      document.body.classList.add('dark-theme')
    })

    await page.goto('/home')
    await page.getByRole('button', { name: 'Admin Manager' }).click()
    await page.getByRole('tab', { name: /Tournaments \(/ }).click()

    const headerColor = await page
      .locator('.catalog-table thead th')
      .first()
      .evaluate((node) => {
        return window.getComputedStyle(node).color
      })
    expect(headerColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(headerColor).not.toBe('rgb(0, 0, 0)')
  })

  test('tournament JSON upload shows duplicate error inline when tournament already exists', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Create Tournament' }).click()
    await page.getByRole('tab', { name: 'JSON' }).click()

    const payload = {
      name: 'T20 World Cup 2026',
      season: '2026',
      tournamentId: 't20wc-2026',
      source: 'json',
      matches: [
        {
          id: 'm1',
          matchNo: 1,
          home: 'IND',
          away: 'AUS',
          startAt: '2099-03-10T14:00',
          timezone: 'UTC',
          venue: 'Test Venue',
        },
      ],
    }

    await page.locator('textarea').fill(JSON.stringify(payload, null, 2))
    await page.getByRole('button', { name: 'Save tournament' }).click()
    await expect(
      page.getByText('Tournament already exists: T20 World Cup 2026'),
    ).toBeVisible()
  })

  test('contest JSON payload create is visible in Fantasy and Admin Manager Contests', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-contest-tour-${tag}`
    const tournamentName = `JSON Contest Tournament ${tag}`
    const contestName = `JSON Contest ${tag}`
    let contestId = ''

    try {
      await createTournamentViaApi({
        request,
        tournamentId,
        name: tournamentName,
      })
      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: contestName,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          joined: false,
          createdBy: 'master',
          matchIds: ['m1', 'm2'],
        },
        201,
      )
      contestId = contest.id

      await loginUi(page, 'master')
      await page.goto('/fantasy')
      await page.locator('.tournament-filter-tile', { hasText: tournamentName }).click()
      const contestCard = page
        .locator('article.compact-contest-card', { hasText: contestName })
        .first()
      await expect(contestCard).toBeVisible()
      await contestCard.getByRole('link', { name: 'Open contest' }).click()
      await expect(page).toHaveURL(
        new RegExp(`/tournaments/${tournamentId}/contests/${contestId}$`),
      )

      await page.goto('/home')
      await page.getByRole('button', { name: 'Admin Manager' }).click()
      await page.getByRole('tab', { name: 'Contests' }).click()
      await page
        .locator('.contest-section-head select')
        .first()
        .selectOption(tournamentId)
      await expect(
        page.locator('.catalog-table tbody tr', { hasText: contestName }),
      ).toBeVisible()
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('same user can hold different teams in two contests on the same match without score collisions', async ({
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `dual-contest-tour-${tag}`
    const tournamentName = `Dual Contest Tournament ${tag}`
    const contestAName = `Dual Contest A ${tag}`
    const contestBName = `Dual Contest B ${tag}`
    let contestAId = ''
    let contestBId = ''

    try {
      await createTournamentViaApi({
        request,
        tournamentId,
        name: tournamentName,
      })

      const contestA = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          actorUserId: 'master',
          name: contestAName,
          tournamentId,
          game: 'Fantasy',
          teams: 10,
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      const contestB = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          actorUserId: 'master',
          name: contestBName,
          tournamentId,
          game: 'Fantasy',
          teams: 10,
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestAId = contestA.id
      contestBId = contestB.id

      await apiCall(
        request,
        'POST',
        `/contests/${contestAId}/join`,
        { userId: 'kiran11' },
        200,
      )
      await apiCall(
        request,
        'POST',
        `/contests/${contestBId}/join`,
        { userId: 'kiran11' },
        200,
      )

      const poolA = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestAId}&matchId=m1&userId=kiran11&actorUserId=kiran11`,
        undefined,
        200,
      )
      const allPlayers = [
        ...(poolA?.teams?.teamA?.players || []),
        ...(poolA?.teams?.teamB?.players || []),
      ]
      expect(allPlayers.length).toBeGreaterThanOrEqual(22)

      const teamASelection = allPlayers.slice(0, 11).map((player) => player.id)
      const teamBSelection = allPlayers.slice(11, 22).map((player) => player.id)

      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId: contestAId,
          matchId: 'm1',
          userId: 'kiran11',
          actorUserId: 'kiran11',
          playingXi: teamASelection,
          backups: [],
        },
        200,
      )
      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId: contestBId,
          matchId: 'm1',
          userId: 'kiran11',
          actorUserId: 'kiran11',
          playingXi: teamBSelection,
          backups: [],
        },
        200,
      )

      const scoreRows = allPlayers.slice(0, 3).map((player, index) => ({
        playerId: player.id,
        playerName: player.name,
        runs: 20 + index * 10,
        fours: 2 + index,
        sixes: 1,
        wickets: 0,
        catches: 0,
      }))

      const scoreSave = await apiCall(
        request,
        'POST',
        '/admin/match-scores/upsert',
        {
          tournamentId,
          matchId: 'm1',
          userId: 'master',
          playerStats: scoreRows,
        },
        200,
      )
      expect(Number(scoreSave.impactedContests || 0)).toBeGreaterThanOrEqual(2)

      const leaderboardA = await apiCall(
        request,
        'GET',
        `/contests/${contestAId}/leaderboard`,
        undefined,
        200,
      )
      const leaderboardB = await apiCall(
        request,
        'GET',
        `/contests/${contestBId}/leaderboard`,
        undefined,
        200,
      )

      const rowA = (leaderboardA.rows || []).find((row) => row.userId === 'kiran11')
      const rowB = (leaderboardB.rows || []).find((row) => row.userId === 'kiran11')
      expect(Number(rowA?.points || 0)).toBeGreaterThan(0)
      expect(Number(rowB?.points || 0)).toBe(0)
    } finally {
      if (contestAId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestAId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      if (contestBId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestBId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('score updates JSON upload updates score meta, stats, and leaderboard', async ({
    page,
    request,
  }) => {
    const beforeStats = await apiCall(
      request,
      'GET',
      '/player-stats?tournamentId=t20wc-2026',
      undefined,
      200,
    )
    const beforeLeaderboard = await apiCall(
      request,
      'GET',
      '/contests/huntercherry/leaderboard',
      undefined,
      200,
    )
    const beforeByUserId = new Map(
      (beforeLeaderboard?.rows || []).map((row) => [row.userId, Number(row.points || 0)]),
    )

    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()
    await page.getByRole('tab', { name: 'JSON Upload' }).click()

    const manualScopeRow = page.locator('.manual-scope-row')
    await manualScopeRow.getByLabel('Tournament').selectOption('t20wc-2026')
    const matchSelect = manualScopeRow.getByLabel('Match')
    const selectedMatchId = await matchSelect.inputValue()
    if (!selectedMatchId) {
      const option = matchSelect.locator('option').nth(1)
      const value = await option.getAttribute('value')
      if (value) await matchSelect.selectOption(value)
    }

    const payload = {
      playerStats: [
        {
          playerName: 'Suryakumar Yadav',
          runs: 173,
          fours: 18,
          sixes: 7,
          wickets: 0,
          catches: 2,
        },
      ],
    }
    await page
      .locator('.match-upload-json textarea')
      .fill(JSON.stringify(payload, null, 2))
    await page.getByRole('button', { name: /^(Save|Upload JSON)$/ }).click()
    await expect(page.getByText(/payload saved/i)).toBeVisible()

    const afterStats = await apiCall(
      request,
      'GET',
      '/player-stats?tournamentId=t20wc-2026',
      undefined,
      200,
    )
    const beforeSurya = (beforeStats || []).find((row) => row.name === 'Suryakumar Yadav')
    const afterSurya = (afterStats || []).find((row) => row.name === 'Suryakumar Yadav')
    expect(afterSurya).toBeTruthy()
    expect(Number(afterSurya.points || 0)).toBeGreaterThan(
      Number(beforeSurya?.points || 0),
    )

    await page.goto('/tournaments/t20wc-2026/cricketer-stats')
    await expect(page.getByRole('heading', { name: 'Cricketer Stats' })).toBeVisible()
    const suryaRow = page.locator('.cricketer-stats-table tbody tr', {
      hasText: 'Suryakumar Yadav',
    })
    await expect(suryaRow).toBeVisible()
    await expect(suryaRow).toContainText(String(Number(afterSurya.points || 0)))

    const afterLeaderboard = await apiCall(
      request,
      'GET',
      '/contests/huntercherry/leaderboard',
      undefined,
      200,
    )
    const didLeaderboardChange = (afterLeaderboard?.rows || []).some((row) => {
      const beforePoints = beforeByUserId.get(row.userId)
      if (beforePoints == null) return true
      return Number(beforePoints) !== Number(row.points || 0)
    })
    expect(didLeaderboardChange).toBe(true)

    await page.goto('/tournaments/t20wc-2026/contests/huntercherry')
    await expect(page.getByText(/^Last score update:/)).toBeVisible()
    await expect(page.getByText('Last score update: -')).toHaveCount(0)

    await page.goto('/tournaments/t20wc-2026/cricketer-stats')
    await expect(
      page
        .locator('.cricketer-stats-table tbody tr', { hasText: 'Suryakumar Yadav' })
        .first(),
    ).toBeVisible()

    await page.goto('/tournaments/t20wc-2026/contests/huntercherry/leaderboard')
    await expect(page.locator('.leaderboard-table tbody tr').first()).toBeVisible()
  })

  test('team selection renders imported squad player names and avatars without object coercion', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-roster-tour-${tag}`
    const tournamentName = `JSON Roster Tournament ${tag}`
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
          selectedTeams: ['RCB', 'SRH'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'RCB',
              away: 'SRH',
              date: '2099-03-10',
              startAt: '2099-03-10T14:00:00.000Z',
              timezone: 'Asia/Kolkata',
              venue: 'Bengaluru',
              squadA: [
                {
                  id: `virat-${tag}`,
                  name: 'Virat Kohli',
                  role: 'BAT',
                  team: 'RCB',
                  teamName: 'Royal Challengers Bengaluru',
                  imageUrl: 'https://images.example.com/virat-kohli.png',
                },
                {
                  id: `patidar-${tag}`,
                  name: 'Rajat Patidar',
                  role: 'BAT',
                  team: 'RCB',
                  teamName: 'Royal Challengers Bengaluru',
                },
              ],
              squadB: [
                {
                  id: `head-${tag}`,
                  name: 'Travis Head',
                  role: 'BAT',
                  team: 'SRH',
                  teamName: 'Sunrisers Hyderabad',
                },
                {
                  id: `cummins-${tag}`,
                  name: 'Pat Cummins',
                  role: 'BOWL',
                  team: 'SRH',
                  teamName: 'Sunrisers Hyderabad',
                },
              ],
            },
          ],
        },
        201,
      )

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Roster Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          joined: true,
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await loginUi(page, 'master')
      await page.goto(`/fantasy/select?contest=${contestId}&match=m1&mode=add`)

      await expect(page.getByText('Virat Kohli')).toBeVisible()
      await expect(
        page
          .locator('.team-column .player-chip .player-identity-subtitle', {
            hasText: 'BAT',
          })
          .first(),
      ).toBeVisible()
      await expect(page.getByText('[object Object]')).toHaveCount(0)
      await expect(page.getByText(/RCB vs SRH • Bengaluru • Starts at:/)).toBeVisible()
      await expect(
        page.locator('.team-column .player-chip .player-avatar img').first(),
      ).toBeVisible()
      await expect(
        page.locator('.team-column .player-chip .player-identity-subtitle').first(),
      ).toContainText(/BAT|BOWL|WK|AR/)

      const viratTile = page.locator('.player-tile', { hasText: 'Virat Kohli' }).first()
      const rajatTile = page.locator('.player-tile', { hasText: 'Rajat Patidar' }).first()
      const viratLayout = await viratTile.evaluate((node) => {
        const meta = node.querySelector('.player-meta')?.getBoundingClientRect()
        const actions = node.querySelector('.tile-actions')?.getBoundingClientRect()
        const avatar = node.querySelector('.player-avatar')?.getBoundingClientRect()
        return meta && actions
          ? {
              metaRight: meta.right,
              actionsLeft: actions.left,
              avatarWidth: avatar?.width || 0,
              avatarHeight: avatar?.height || 0,
            }
          : null
      })
      expect(viratLayout).toBeTruthy()
      expect(viratLayout.actionsLeft).toBeGreaterThan(viratLayout.metaRight - 2)
      expect(viratLayout.avatarWidth).toBeLessThanOrEqual(40)
      expect(viratLayout.avatarHeight).toBeLessThanOrEqual(40)
      await viratTile.getByRole('button', { name: '+' }).click()
      await rajatTile.getByRole('button', { name: 'B' }).click()

      await expect(page.locator('.myxi-slots .player-avatar').first()).toBeVisible()
      await expect(
        page.locator('.myxi-slots .player-chip.slot-chip.compact').first(),
      ).toContainText('Virat Kohli')
      await expect(
        page.locator('.backups-grid .player-chip.slot-chip.compact').first(),
      ).toBeVisible()
      await expect(
        page.locator(
          '.backups-grid .player-chip.slot-chip.compact .player-avatar-fallback',
        ),
      ).toContainText('RP')

      const backupChipStyles = await page
        .locator('.backups-grid .player-chip.slot-chip.compact')
        .first()
        .evaluate((node) => {
          const style = window.getComputedStyle(node)
          return {
            display: style.display,
            flexDirection: style.flexDirection,
            alignItems: style.alignItems,
          }
        })
      expect(backupChipStyles).toEqual({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      })

      const columnGridStyles = await page
        .locator('.tile-grid.two-col')
        .first()
        .evaluate((node) => {
          const style = window.getComputedStyle(node)
          return {
            alignContent: style.alignContent,
          }
        })
      expect(columnGridStyles.alignContent).toBe('stretch')

      const rightColumnHeight = await page
        .locator('.right-column')
        .evaluate((node) => node.clientHeight)
      const myxiCardHeight = await page
        .locator('.myxi-card')
        .evaluate((node) => node.clientHeight)
      const backupsCardHeight = await page
        .locator('.backups-card')
        .evaluate((node) => node.clientHeight)
      const myxiSlotsStyles = await page.locator('.myxi-slots').evaluate((node) => {
        const style = window.getComputedStyle(node)
        return {
          alignContent: style.alignContent,
          gridAutoRows: style.gridAutoRows,
        }
      })
      expect(myxiSlotsStyles.alignContent).toBe('stretch')
      expect(myxiSlotsStyles.gridAutoRows).not.toBe('40px')
      expect(rightColumnHeight).toBeGreaterThan(350)
      expect(myxiCardHeight).toBeGreaterThan(180)
      expect(backupsCardHeight).toBeGreaterThan(120)
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('announced playing XI shows green/red lineup lights on team selection tiles', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-lineup-tour-${tag}`
    let contestId = ''

    try {
      await createTournamentViaApi({
        request,
        tournamentId,
        name: `JSON Lineup Tournament ${tag}`,
      })

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Lineup Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      const pool = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=m1&userId=player`,
        undefined,
        200,
      )

      const teamAName = pool?.teams?.teamA?.name || 'LQ'
      const teamBName = pool?.teams?.teamB?.name || 'IU'
      const teamAPlayers = pool?.teams?.teamA?.players || []
      const teamBPlayers = pool?.teams?.teamB?.players || []
      const playingXi = [...teamAPlayers.slice(0, 6), ...teamBPlayers.slice(0, 5)].map(
        (player) => player.id,
      )
      const backups = [teamAPlayers[11], teamBPlayers[11]]
        .filter(Boolean)
        .map((player) => player.id)

      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'm1',
          userId: 'player',
          playingXi,
          backups,
          captainId: playingXi[0],
          viceCaptainId: playingXi[1],
        },
        200,
      )

      await apiCall(
        request,
        'POST',
        '/admin/match-lineups/upsert',
        {
          tournamentId,
          contestId,
          matchId: 'm1',
          updatedBy: 'master',
          lineups: {
            [teamAName]: {
              squad: teamAPlayers.map((player) => player.name),
              playingXI: teamAPlayers.slice(0, 11).map((player) => player.name),
              bench: teamAPlayers.slice(11).map((player) => player.name),
            },
            [teamBName]: {
              squad: teamBPlayers.map((player) => player.name),
              playingXI: teamBPlayers.slice(0, 11).map((player) => player.name),
              bench: teamBPlayers.slice(11).map((player) => player.name),
            },
          },
        },
        200,
      )

      await loginUi(page, 'player')
      await page.setViewportSize({ width: 1180, height: 900 })
      await page.goto(`/fantasy/select?contest=${contestId}&match=m1&mode=edit`)

      await expect(
        page.locator('.player-tile.lineup-playing .lineup-status-light.playing').first(),
      ).toBeVisible()
      await expect(
        page.locator('.player-tile.lineup-bench .lineup-status-light.bench').first(),
      ).toBeVisible()
      await expect(
        page.locator('.myxi-slots .lineup-status-light.playing').first(),
      ).toBeVisible()
      await expect(
        page.locator('.backups-grid .lineup-status-light.bench').first(),
      ).toBeVisible()
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('score updates panel saves Playing XI through the UI and contest team view shows lineup indicators', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-lineup-ui-tour-${tag}`
    let contestId = ''

    try {
      await createTournamentViaApi({
        request,
        tournamentId,
        name: `JSON Lineup UI Tournament ${tag}`,
      })

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Lineup UI Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      const pool = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=m1&userId=master&actorUserId=master`,
        undefined,
        200,
      )
      const teamAName = pool?.teams?.teamA?.name || 'LQ'
      const teamBName = pool?.teams?.teamB?.name || 'IU'
      const teamAPlayers = pool?.teams?.teamA?.players || []
      const teamBPlayers = pool?.teams?.teamB?.players || []
      expect(teamAPlayers.length).toBeGreaterThanOrEqual(12)
      expect(teamBPlayers.length).toBeGreaterThanOrEqual(11)
      const selectedIndicatorPlayer = teamAPlayers[0]?.name
      const benchIndicatorPlayer = teamAPlayers[11]?.name

      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Score Manager' }).click()
      const shellHeight = await page
        .locator('.dashboard-shell')
        .evaluate((node) => node.clientHeight)
      const panelViewHeight = await page
        .locator('.dashboard-panel-view')
        .evaluate((node) => node.clientHeight)
      expect(shellHeight).toBeGreaterThan(500)
      expect(panelViewHeight).toBeGreaterThan(400)
      const playingXiTab = page.getByRole('tab', { name: 'Playing XI' })
      const scorecardsTab = page.getByRole('tab', { name: 'Scorecards' })
      await expect(playingXiTab).toHaveClass(/active/)
      await expect(scorecardsTab).not.toHaveClass(/active/)
      await expect(playingXiTab).toHaveCSS('border-radius', '999px')
      await expect(scorecardsTab).toHaveCSS('border-radius', '999px')
      const scopeRow = page.locator('.manual-scope-row')
      await scopeRow.getByLabel('Tournament').selectOption(tournamentId)
      await scopeRow.getByLabel('Match').selectOption('m1')
      await expect(page.getByRole('tab', { name: 'Bat' })).toHaveCount(0)
      await expect(page.locator('.manual-team-card')).toHaveCount(2)
      await expect(page.locator('.manual-lineup-card')).toHaveCount(2)
      await expect(page.locator('.manual-lineup-table')).toHaveCount(2)
      await expect(
        page
          .locator('.manual-lineup-card', { hasText: `${teamAPlayers.length} players` })
          .first(),
      ).toBeVisible()
      await expect(
        page
          .locator('.manual-lineup-card', { hasText: `${teamBPlayers.length} players` })
          .first(),
      ).toBeVisible()
      await expect(page.locator('.manual-lineup-shell')).toHaveCount(0)
      const tableWrapHeight = await page
        .locator('.manual-team-table-wrap')
        .first()
        .evaluate((node) => {
          const style = window.getComputedStyle(node)
          return {
            height: style.height,
            overflowY: style.overflowY,
          }
        })
      expect(tableWrapHeight.overflowY).toBe('auto')
      expect(parseFloat(tableWrapHeight.height)).toBeGreaterThan(250)
      await expect(
        page.locator('.manual-lineup-table tbody input[type="checkbox"]:checked'),
      ).toHaveCount(0)

      const teamCard = page.locator('.manual-lineup-card', { hasText: teamAName }).first()
      const teamACheckboxes = teamCard.locator('tbody tr input[type="checkbox"]')
      for (let index = 0; index < 11; index += 1) {
        await teamACheckboxes.nth(index).check()
      }
      await expect(teamCard.locator('.manual-lineup-count')).toContainText('11/12')

      const teamBCard = page
        .locator('.manual-lineup-card', { hasText: teamBName })
        .first()
      const teamBCheckboxes = teamBCard.locator('tbody tr input[type="checkbox"]')
      for (let index = 0; index < 11; index += 1) {
        await teamBCheckboxes.nth(index).check()
      }
      await expect(teamBCard.locator('.manual-lineup-count')).toContainText('11/12')
      await expect(teamCard.locator('.manual-lineup-count')).toContainText('11/12')
      await page.getByRole('button', { name: 'Save Playing XI' }).click()
      await page.waitForTimeout(300)
      const saved = await apiCall(
        request,
        'GET',
        `/admin/match-lineups/${tournamentId}/m1`,
        undefined,
        200,
      )
      expect(saved?.saved?.lineups?.[teamAName]?.playingXI || []).toContain(
        selectedIndicatorPlayer,
      )
      expect(saved?.saved?.lineups?.[teamAName]?.playingXI || []).not.toContain(
        benchIndicatorPlayer,
      )

      await loginUi(page, 'player')
      await page.goto(`/fantasy/select?contest=${contestId}&match=m1&mode=add`)

      await expect(
        page
          .locator('.player-tile', { hasText: selectedIndicatorPlayer })
          .locator('.lineup-status-light.playing'),
      ).toBeVisible()
      await expect(
        page
          .locator('.player-tile', { hasText: benchIndicatorPlayer })
          .locator('.lineup-status-light.bench'),
      ).toBeVisible()
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('future match without saved lineup starts with no Playing XI preselected', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-lineup-empty-tour-${tag}`
    let contestId = ''

    try {
      await createTournamentViaApi({
        request,
        tournamentId,
        name: `JSON Empty Lineup Tournament ${tag}`,
      })

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Empty Lineup Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Score Manager' }).click()
      const scopeRow = page.locator('.manual-scope-row')
      await scopeRow.getByLabel('Tournament').selectOption(tournamentId)
      await scopeRow.getByLabel('Match').selectOption('m1')

      await expect(
        page.locator('.manual-lineup-table tbody input[type="checkbox"]:checked'),
      ).toHaveCount(0)
      await expect(page.locator('.manual-lineup-count')).toHaveText(['0/12', '0/12'])
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('mobile score updates stacks the two scorecard tables without overlap', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 430, height: 932 })
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()
    await page.getByRole('tab', { name: 'Scorecards' }).click()
    await page.getByRole('tab', { name: 'Manual Entry' }).click()
    await expect(
      page.getByText('Excel upload is disabled for now. Use Manual or JSON.'),
    ).toHaveCount(0)

    const tabButtonHeight = await page
      .getByRole('tab', { name: 'Scorecards' })
      .evaluate((node) => {
        return parseFloat(window.getComputedStyle(node).height)
      })
    expect(tabButtonHeight).toBeLessThanOrEqual(34)

    const saveButtonHeight = await page
      .getByRole('button', { name: 'Save' })
      .evaluate((node) => {
        return parseFloat(window.getComputedStyle(node).height)
      })
    expect(saveButtonHeight).toBeLessThanOrEqual(34)

    const scopeRow = page.locator('.manual-scope-row')
    const tournamentSelect = scopeRow.getByLabel('Tournament')
    const selectedTournament = await tournamentSelect.inputValue()
    if (!selectedTournament) {
      const option = tournamentSelect.locator('option').nth(1)
      const value = await option.getAttribute('value')
      if (value) await tournamentSelect.selectOption(value)
    }

    const matchSelect = scopeRow.getByLabel('Match')
    const selectedMatch = await matchSelect.inputValue()
    if (!selectedMatch) {
      const option = matchSelect.locator('option').nth(1)
      const value = await option.getAttribute('value')
      if (value) await matchSelect.selectOption(value)
    }

    const cards = page.locator('.manual-team-card')
    await expect(cards).toHaveCount(2)
    const firstBox = await cards.nth(0).boundingBox()
    const secondBox = await cards.nth(1).boundingBox()
    expect(firstBox).toBeTruthy()
    expect(secondBox).toBeTruthy()
    expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height + 8)
  })

  test('mobile cricketer stats keeps player names readable', async ({ page }) => {
    await loginUi(page, 'master')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/tournaments/t20wc-2026/cricketer-stats')
    await expect(page.getByRole('heading', { name: 'Cricketer Stats' })).toBeVisible()

    const firstPlayerCell = page
      .locator('.cricketer-stats-table tbody tr')
      .first()
      .locator('td')
      .first()
    await expect(firstPlayerCell.locator('.player-identity-name')).toBeVisible()
    await expect(firstPlayerCell.locator('.player-identity-name')).not.toHaveText(/^.$/)
    await expect(firstPlayerCell.locator('.player-avatar')).toBeVisible()
  })

  test('manual score number input replaces the seeded zero when typing', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()
    await page.getByRole('tab', { name: 'Scorecards' }).click()
    await page.getByRole('tab', { name: 'Manual Entry' }).click()

    const scopeRow = page.locator('.manual-scope-row')
    const tournamentSelect = scopeRow.getByLabel('Tournament')
    const selectedTournament = await tournamentSelect.inputValue()
    if (!selectedTournament) {
      const option = tournamentSelect.locator('option').nth(1)
      const value = await option.getAttribute('value')
      if (value) await tournamentSelect.selectOption(value)
    }

    const matchSelect = scopeRow.getByLabel('Match')
    const selectedMatch = await matchSelect.inputValue()
    if (!selectedMatch) {
      const option = matchSelect.locator('option').nth(1)
      const value = await option.getAttribute('value')
      if (value) await matchSelect.selectOption(value)
    }

    const firstRunsInput = page.locator('.manual-team-table input[type="number"]').first()
    await firstRunsInput.click()
    await page.keyboard.type('22')
    await expect(firstRunsInput).toHaveValue('22')
  })

  test('bowling manual score tab shows standard bowling columns including overs and runs conceded', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()
    await page.getByRole('tab', { name: 'Scorecards' }).click()
    await page.getByRole('tab', { name: 'Manual Entry' }).click()

    const scopeRow = page.locator('.manual-scope-row')
    const tournamentSelect = scopeRow.getByLabel('Tournament')
    const selectedTournament = await tournamentSelect.inputValue()
    if (!selectedTournament) {
      const option = tournamentSelect.locator('option').nth(1)
      const value = await option.getAttribute('value')
      if (value) await tournamentSelect.selectOption(value)
    }

    const matchSelect = scopeRow.getByLabel('Match')
    const selectedMatch = await matchSelect.inputValue()
    if (!selectedMatch) {
      const option = matchSelect.locator('option').nth(1)
      const value = await option.getAttribute('value')
      if (value) await matchSelect.selectOption(value)
    }

    await page.getByRole('tab', { name: 'Bowl' }).click()

    const headerRow = page.locator('.manual-team-table thead tr').first()
    await expect(headerRow).toContainText('Player')
    await expect(headerRow).toContainText('Role')
    await expect(headerRow).toContainText('O')
    await expect(headerRow).toContainText('M')
    await expect(headerRow).toContainText('R')
    await expect(headerRow).toContainText('Wkts')
    await expect(headerRow).toContainText('NB')
    await expect(headerRow).toContainText('WD')
    await expect(headerRow).toContainText('ECO')
  })

  test('batting manual score tab shows standard batting columns including balls and strike rate', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()
    await page.getByRole('tab', { name: 'Scorecards' }).click()
    await page.getByRole('tab', { name: 'Manual Entry' }).click()

    const scopeRow = page.locator('.manual-scope-row')
    const tournamentSelect = scopeRow.getByLabel('Tournament')
    const selectedTournament = await tournamentSelect.inputValue()
    if (!selectedTournament) {
      const option = tournamentSelect.locator('option').nth(1)
      const value = await option.getAttribute('value')
      if (value) await tournamentSelect.selectOption(value)
    }

    const matchSelect = scopeRow.getByLabel('Match')
    const selectedMatch = await matchSelect.inputValue()
    if (!selectedMatch) {
      const option = matchSelect.locator('option').nth(1)
      const value = await option.getAttribute('value')
      if (value) await matchSelect.selectOption(value)
    }

    await page.getByRole('tab', { name: 'Bat' }).click()

    const headerRow = page.locator('.manual-team-table thead tr').first()
    await expect(headerRow).toContainText('Player')
    await expect(headerRow).toContainText('Role')
    await expect(headerRow).toContainText('R')
    await expect(headerRow).toContainText('B')
    await expect(headerRow).toContainText('4s')
    await expect(headerRow).toContainText('6s')
    await expect(headerRow).toContainText('SR')
    await expect(headerRow).toContainText('Out')

    const firstPlayerCell = page
      .locator('.manual-team-table tbody tr td.manual-col-player')
      .first()
    await expect(firstPlayerCell.locator('.player-avatar')).toBeVisible()

    const tableWrap = page.locator('.manual-team-table-wrap').first()
    const before = await firstPlayerCell.boundingBox()
    await tableWrap.evaluate((node) => {
      node.scrollLeft = 240
      node.dispatchEvent(new Event('scroll'))
    })
    await page.waitForTimeout(100)
    const after = await firstPlayerCell.boundingBox()
    expect(before).toBeTruthy()
    expect(after).toBeTruthy()
    expect(Math.abs((after?.x || 0) - (before?.x || 0))).toBeLessThanOrEqual(3)
  })

  test('score updates panel accepts lineup JSON upload for the selected tournament match', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-lineup-json-tour-${tag}`
    let contestId = ''

    try {
      await createTournamentViaApi({
        request,
        tournamentId,
        name: `JSON Lineup Upload Tournament ${tag}`,
      })

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Lineup Upload Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      const pool = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=m1&userId=master&actorUserId=master`,
        undefined,
        200,
      )
      const teamAName = pool?.teams?.teamA?.name || 'LQ'
      const teamBName = pool?.teams?.teamB?.name || 'IU'
      const teamAPlayers = pool?.teams?.teamA?.players || []
      const teamBPlayers = pool?.teams?.teamB?.players || []

      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Score Manager' }).click()
      const scopeRow = page.locator('.manual-scope-row')
      await scopeRow.getByLabel('Tournament').selectOption(tournamentId)
      await scopeRow.getByLabel('Match').selectOption('m1')
      await page.getByRole('tab', { name: 'JSON Upload' }).click()

      const lineupPayload = {
        lineups: {
          [teamAName]: {
            playingXI: teamAPlayers.slice(0, 12).map((player) => player.name),
            bench: teamAPlayers.slice(12).map((player) => player.name),
          },
          [teamBName]: {
            playingXI: teamBPlayers.slice(0, 11).map((player) => player.name),
            bench: teamBPlayers.slice(11).map((player) => player.name),
          },
        },
      }

      await page
        .locator('.match-upload-json textarea')
        .fill(JSON.stringify(lineupPayload, null, 2))
      await page.getByRole('button', { name: 'Preview Playing XI JSON' }).click()
      await expect(
        page.getByRole('dialog', { name: 'Processed lineup JSON preview' }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Confirm Save' }).click()
      await page.waitForTimeout(300)
      const saved = await apiCall(
        request,
        'GET',
        `/admin/match-lineups/${tournamentId}/m1`,
        undefined,
        200,
      )
      expect(saved?.saved?.lineups?.[teamAName]?.playingXI || []).toHaveLength(12)
      expect(saved?.saved?.lineups?.[teamBName]?.playingXI || []).toHaveLength(11)
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('scorecard JSON upload hydrates manual entry values for the selected match', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-score-hydrate-tour-${tag}`
    let contestId = ''

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON Score Hydrate Tournament ${tag}`,
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

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Score Hydrate Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      const pool = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=m1&userId=master&actorUserId=master`,
        undefined,
        200,
      )
      const allPlayers = [
        ...(pool?.teams?.teamA?.players || []),
        ...(pool?.teams?.teamB?.players || []),
      ]
      const targetPlayer =
        allPlayers.find((player) => player.role === 'BAT') ||
        allPlayers.find((player) => player.role === 'AR') ||
        allPlayers[0]
      expect(targetPlayer).toBeTruthy()

      await loginUi(page, 'master')
      await page.goto('/home')
      await page.getByRole('button', { name: 'Score Manager' }).click()
      const scorecardsTab = page.getByRole('tab', { name: 'Scorecards' })
      if (await scorecardsTab.count()) {
        await scorecardsTab.click()
      }
      await page.getByRole('tab', { name: 'JSON Upload' }).click()

      const selects = page.locator('.manual-scope-row select')
      await selects.nth(0).selectOption(tournamentId)
      await selects.nth(1).selectOption('m1')

      const payload = {
        playerStats: [
          {
            playerId: targetPlayer.id,
            playerName: targetPlayer.name,
            runs: 67,
            ballsFaced: 40,
            fours: 3,
            sixes: 5,
            dismissed: true,
          },
        ],
      }

      await page
        .locator('.match-upload-json textarea')
        .fill(JSON.stringify(payload, null, 2))
      await expect(page.getByRole('button', { name: 'Mark as Complete' })).toBeDisabled()
      await page.getByRole('button', { name: 'Upload JSON' }).click()
      await expect(
        page.getByRole('dialog', { name: 'Processed scorecard JSON preview' }),
      ).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Processed Scorecard JSON' })).toBeVisible()
      await expect(page.getByRole('cell', { name: targetPlayer.name })).toBeVisible()
      await page.getByRole('button', { name: 'Confirm Save' }).click()
      await expect(page.getByText(/payload saved/i)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Mark as Complete' })).toBeEnabled()

      await page.getByRole('tab', { name: 'Manual Entry' }).click()
      await page.getByRole('tab', { name: 'Bat' }).click()

      const playerRow = page.locator('tbody tr', { hasText: targetPlayer.name }).first()
      await expect(playerRow).toBeVisible()
      await expect(playerRow.locator('input[type="number"]').nth(0)).toHaveValue('67')
      await expect(playerRow.locator('input[type="number"]').nth(1)).toHaveValue('40')
      await expect(playerRow.locator('input[type="number"]').nth(2)).toHaveValue('3')
      await expect(playerRow.locator('input[type="number"]').nth(3)).toHaveValue('5')
      await expect(playerRow.locator('input[type="checkbox"]')).toBeChecked()
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('scorecard JSON upload shows inline unmatched diagnostics for unknown player names', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Manager' }).click()

    const scorecardsTab = page.getByRole('tab', { name: 'Scorecards' })
    if (await scorecardsTab.count()) {
      await scorecardsTab.click()
    }
    await page.getByRole('tab', { name: 'JSON Upload' }).click()

    const selects = page.locator('.manual-scope-row select')
    await selects.nth(0).selectOption({ index: 1 })
    await expect
      .poll(async () => selects.nth(1).locator('option').count(), { timeout: 15000 })
      .toBeGreaterThan(1)
    await selects.nth(1).selectOption({ index: 1 })

    const payload = {
      playerStats: [
        {
          playerName: 'Xyz Unknown Person',
          runs: 12,
          ballsFaced: 9,
          fours: 2,
          sixes: 0,
          dismissed: true,
        },
      ],
    }

    await page
      .locator('.match-upload-json textarea')
      .fill(JSON.stringify(payload, null, 2))
    await page.getByRole('button', { name: /^(Save|Upload JSON)$/ }).click()

    const diagnostics = page.locator('.json-upload-diagnostics')
    await expect(diagnostics).toBeVisible()
    await expect(diagnostics).toContainText('Unmatched Players')
    await expect(diagnostics).toContainText('Xyz Unknown Person')
    await expect(diagnostics).toContainText('normalized: xyz unknown person')
  })

  test('team-pool and team save persist through the selection API', async ({
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-save-tour-${tag}`
    let contestId = ''

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON Save Tournament ${tag}`,
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

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Save Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: 'player' },
        200,
      )

      const pool = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=m1&userId=player`,
        undefined,
        200,
      )

      const allPlayers = [
        ...(pool?.teams?.teamA?.players || []),
        ...(pool?.teams?.teamB?.players || []),
      ]
      expect(allPlayers.length).toBeGreaterThanOrEqual(11)

      const playingXi = allPlayers.slice(0, 11).map((player) => player.id)
      const backups = allPlayers.slice(11, 14).map((player) => player.id)
      const captainId = playingXi[0]
      const viceCaptainId = playingXi[1]

      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'm1',
          userId: 'player',
          playingXi,
          backups,
          captainId,
          viceCaptainId,
        },
        200,
      )

      const refreshed = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=m1&userId=player`,
        undefined,
        200,
      )
      expect(refreshed?.selection?.playingXi || []).toEqual(playingXi)
      expect(refreshed?.selection?.backups || []).toEqual(backups)
      expect(refreshed?.selection?.captainId).toBe(captainId)
      expect(refreshed?.selection?.viceCaptainId).toBe(viceCaptainId)
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('captain and vice captain multipliers boost leaderboard points', async ({
    request,
    page,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-cvc-tour-${tag}`
    let contestId = ''

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON CVC Tournament ${tag}`,
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

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON CVC Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await loginUi(page, 'player')
      const joinResponse = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.joinContest({ contestId: innerContestId, userId: 'player' })
        },
        { innerContestId: contestId },
      )
      expect(
        joinResponse?.joined || joinResponse?.ok || joinResponse?.contestId,
      ).toBeTruthy()

      const pool = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.fetchTeamPool({
            contestId: innerContestId,
            matchId: 'm1',
            userId: 'player',
          })
        },
        { innerContestId: contestId },
      )
      const playingXi = buildValidPlayingXi(
        pool?.teams?.teamA?.players || [],
        pool?.teams?.teamB?.players || [],
      )
      const allPlayers = [
        ...(pool?.teams?.teamA?.players || []),
        ...(pool?.teams?.teamB?.players || []),
      ]
      const playerById = new Map(allPlayers.map((player) => [player.id, player]))
      const captain = playerById.get(playingXi[0])
      const viceCaptain = playerById.get(playingXi[1])

      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'm1',
          userId: 'player',
          playingXi,
          backups: [],
          captainId: captain.id,
          viceCaptainId: viceCaptain.id,
        },
        200,
      )

      await apiCall(
        request,
        'POST',
        '/admin/match-scores/upsert',
        {
          tournamentId,
          matchId: 'm1',
          userId: 'master',
          playerStats: [
            {
              playerId: captain.id,
              playerName: captain.name,
              runs: 20,
              fours: 2,
              sixes: 1,
            },
            {
              playerId: viceCaptain.id,
              playerName: viceCaptain.name,
              runs: 10,
              fours: 1,
              sixes: 0,
            },
          ],
        },
        200,
      )

      const leaderboard = await apiCall(
        request,
        'GET',
        `/contests/${contestId}/leaderboard`,
        undefined,
        200,
      )
      const playerRow = (leaderboard.rows || []).find((row) => row.userId === 'player')
      expect(Number(playerRow?.points || 0)).toBe(64.5)
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('team preview payload exposes multiplied captain and vice captain breakdown', async ({
    request,
    page,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-preview-cvc-tour-${tag}`
    let contestId = ''

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON Preview CVC Tournament ${tag}`,
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

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Preview CVC Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await loginUi(page, 'player')
      await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.joinContest({ contestId: innerContestId, userId: 'player' })
        },
        { innerContestId: contestId },
      )

      const pool = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.fetchTeamPool({
            contestId: innerContestId,
            matchId: 'm1',
            userId: 'player',
          })
        },
        { innerContestId: contestId },
      )
      const playingXi = buildValidPlayingXi(
        pool?.teams?.teamA?.players || [],
        pool?.teams?.teamB?.players || [],
      )
      const allPlayers = [
        ...(pool?.teams?.teamA?.players || []),
        ...(pool?.teams?.teamB?.players || []),
      ]
      const playerById = new Map(allPlayers.map((player) => [player.id, player]))
      const captain = playerById.get(playingXi[0])
      const viceCaptain = playerById.get(playingXi[1])

      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'm1',
          userId: 'player',
          playingXi,
          backups: [],
          captainId: captain.id,
          viceCaptainId: viceCaptain.id,
        },
        200,
      )

      await apiCall(
        request,
        'POST',
        '/admin/match-scores/upsert',
        {
          tournamentId,
          matchId: 'm1',
          userId: 'master',
          playerStats: [
            {
              playerId: captain.id,
              playerName: captain.name,
              runs: 20,
              fours: 2,
              sixes: 1,
            },
            {
              playerId: viceCaptain.id,
              playerName: viceCaptain.name,
              runs: 10,
              fours: 1,
              sixes: 0,
            },
          ],
        },
        200,
      )

      const picks = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.fetchUserPicks({
            userId: 'player',
            contestId: innerContestId,
            matchId: 'm1',
          })
        },
        { innerContestId: contestId },
      )

      const captainRow = (picks?.picksDetailed || []).find((row) => row.id === captain.id)
      const viceCaptainRow = (picks?.picksDetailed || []).find(
        (row) => row.id === viceCaptain.id,
      )

      expect(captainRow?.roleTag).toBe('C')
      expect(Number(captainRow?.basePoints || 0)).toBe(24)
      expect(Number(captainRow?.multiplier || 0)).toBe(2)
      expect(Number(captainRow?.points || 0)).toBe(48)
      expect((captainRow?.pointBreakdown || []).map((row) => row.label)).toEqual(
        expect.arrayContaining(['Runs', 'Fours', 'Sixes']),
      )

      expect(viceCaptainRow?.roleTag).toBe('VC')
      expect(Number(viceCaptainRow?.basePoints || 0)).toBe(11)
      expect(Number(viceCaptainRow?.multiplier || 0)).toBe(1.5)
      expect(Number(viceCaptainRow?.points || 0)).toBe(16.5)
      expect((viceCaptainRow?.pointBreakdown || []).map((row) => row.label)).toEqual(
        expect.arrayContaining(['Runs', 'Fours']),
      )
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('expanded scoring rules apply screenshot-backed milestone and rate bonuses', async ({
    request,
    page,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-expanded-rules-tour-${tag}`
    let contestId = ''
    let previousRules = null

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON Expanded Rules Tournament ${tag}`,
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

      const pageLoad = await apiCall(request, 'GET', '/page-load-data', undefined, 200)
      previousRules = JSON.parse(
        JSON.stringify(pageLoad?.pointsRuleTemplate || {}),
      )

      await apiCall(
        request,
        'POST',
        '/scoring-rules/save',
        {
          actorUserId: 'master',
          rules: {
            batting: [
              { id: 'run', label: 'Each Run', value: 1 },
              { id: 'four', label: 'Each Four', value: 1 },
              { id: 'six', label: 'Each Six', value: 2 },
              { id: 'thirty', label: '30 Runs Bonus', value: 3 },
              { id: 'fifty', label: '50 Runs Bonus', value: 5 },
              { id: 'seventyFive', label: '75 Runs Bonus', value: 7 },
              { id: 'century', label: '100 Runs Bonus', value: 10 },
              { id: 'oneFifty', label: '150 Runs Bonus', value: 15 },
              { id: 'twoHundred', label: '200+ Runs Bonus', value: 20 },
              { id: 'duck', label: 'Duck Out', value: -5 },
              { id: 'strikeRate150', label: 'Strike Rate 150+', value: 5 },
              { id: 'strikeRate200', label: 'Strike Rate 200+', value: 10 },
              { id: 'strikeRate250', label: 'Strike Rate 250+', value: 15 },
              { id: 'strikeRateBelow80', label: 'Strike Rate Below 80', value: -5 },
            ],
            bowling: [
              { id: 'wicket', label: 'Each Wicket', value: 20 },
              { id: 'maiden', label: 'Maiden Over', value: 8 },
              { id: 'threew', label: '3-Wicket Bonus', value: 5 },
              { id: 'fourw', label: '4-Wicket Bonus', value: 10 },
              { id: 'fivew', label: '5-Wicket Bonus', value: 15 },
              { id: 'wide', label: 'Wide / No-ball', value: -1 },
              { id: 'economyBelow3', label: 'Economy 3 or Less', value: 15 },
              { id: 'economyBelow5', label: 'Economy 5 or Less', value: 10 },
              { id: 'economyBelow6', label: 'Economy 6 or Less', value: 5 },
              { id: 'economyAbove10', label: 'Economy 10+', value: -3 },
              { id: 'economyAbove12', label: 'Economy 12+', value: -5 },
              { id: 'hatTrick', label: 'Hat-trick Bonus', value: 10 },
            ],
            fielding: [
              { id: 'catch', label: 'Each Catch', value: 5 },
              { id: 'threeCatch', label: '3+ Catches Bonus', value: 5 },
              { id: 'stumping', label: 'Stumping', value: 12 },
              { id: 'twoStumping', label: '2+ Stumpings Bonus', value: 5 },
              { id: 'runout-direct', label: 'Runout (Direct Hit)', value: 12 },
              { id: 'runout-indirect', label: 'Runout (Assist)', value: 6 },
            ],
          },
        },
        200,
      )

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Expanded Rules Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await loginUi(page, 'player')
      await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.joinContest({ contestId: innerContestId, userId: 'player' })
        },
        { innerContestId: contestId },
      )

      const pool = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.fetchTeamPool({
            contestId: innerContestId,
            matchId: 'm1',
            userId: 'player',
          })
        },
        { innerContestId: contestId },
      )
      const playingXi = buildValidPlayingXi(
        pool?.teams?.teamA?.players || [],
        pool?.teams?.teamB?.players || [],
      )
      const allPlayers = [
        ...(pool?.teams?.teamA?.players || []),
        ...(pool?.teams?.teamB?.players || []),
      ]
      const playerById = new Map(allPlayers.map((player) => [player.id, player]))
      const captain = playerById.get(playingXi[0])

      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'm1',
          userId: 'player',
          playingXi,
          backups: [],
          captainId: captain.id,
          viceCaptainId: playingXi[1],
        },
        200,
      )

      await apiCall(
        request,
        'POST',
        '/admin/match-scores/upsert',
        {
          tournamentId,
          matchId: 'm1',
          userId: 'master',
          playerStats: [
            {
              playerId: captain.id,
              playerName: captain.name,
              runs: 80,
              ballsFaced: 32,
              fours: 6,
              sixes: 4,
              wickets: 3,
              overs: 4,
              maidens: 1,
              runsConceded: 10,
              noBalls: 0,
              wides: 0,
              catches: 3,
              stumpings: 2,
              runoutDirect: 0,
              runoutIndirect: 0,
              hatTrick: 1,
              dismissed: true,
            },
          ],
        },
        200,
      )

      const picks = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.fetchUserPicks({
            userId: 'player',
            contestId: innerContestId,
            matchId: 'm1',
          })
        },
        { innerContestId: contestId },
      )

      const captainRow = (picks?.picksDetailed || []).find((row) => row.id === captain.id)
      const labels = (captainRow?.pointBreakdown || []).map((row) => row.label)
      expect(labels).toEqual(
        expect.arrayContaining([
          '75 bonus',
          'Strike rate 250+',
          'Hat-trick',
          'Three wicket bonus',
          'Economy 3 or less',
          '3+ catches bonus',
          '2+ stumpings bonus',
        ]),
      )
      expect(Number(captainRow?.basePoints || 0)).toBe(263)
      expect(Number(captainRow?.points || 0)).toBe(526)
    } finally {
      if (previousRules) {
        await request.fetch('http://127.0.0.1:4000/scoring-rules/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master', rules: previousRules },
        })
      }
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('captain and vice captain are chosen in MyXI Picks and required before saving', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-cvc-ui-tour-${tag}`
    let contestId = ''
    const bestEffortDelete = async (url, data) => {
      await Promise.race([
        request.fetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data,
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]).catch(() => {})
    }

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON CVC UI Tournament ${tag}`,
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

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON CVC UI Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await loginUi(page, 'player')
      const joinResponse = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.joinContest({ contestId: innerContestId, userId: 'player' })
        },
        { innerContestId: contestId },
      )
      expect(
        joinResponse?.joined || joinResponse?.ok || joinResponse?.contestId,
      ).toBeTruthy()

      const pool = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.fetchTeamPool({
            contestId: innerContestId,
            matchId: 'm1',
            userId: 'player',
          })
        },
        { innerContestId: contestId },
      )
      const playingXi = buildValidPlayingXi(
        pool?.teams?.teamA?.players || [],
        pool?.teams?.teamB?.players || [],
      )
      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'm1',
          userId: 'player',
          playingXi,
          backups: [],
          captainId: playingXi[0],
          viceCaptainId: playingXi[1],
        },
        200,
      )

      await loginUi(page, 'player')
      await page.goto(`/fantasy/select?contest=${contestId}&match=m1&mode=edit`)

      await expect(page.locator('.team-column .tile-btn', { hasText: 'C' })).toHaveCount(
        0,
      )
      await expect(page.locator('.team-column .tile-btn', { hasText: 'VC' })).toHaveCount(
        0,
      )
      await expect(page.locator('.myxi-role-card')).toHaveCount(0)
      await expect(page.locator('.player-role-btn')).toHaveCount(0)
      await expect(page.locator('.myxi-role-selectors')).toBeVisible()
      await expect(page.locator('.myxi-role-field > span')).toHaveText(['C', 'VC'])
      const captainSelect = page.locator('.myxi-role-select').first()
      const viceCaptainSelect = page.locator('.myxi-role-select').nth(1)
      await expect(captainSelect).toBeVisible()
      await expect(viceCaptainSelect).toBeVisible()
      const selectorLayout = await page.locator('.myxi-role-field').evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect()
          return { top: rect.top, left: rect.left }
        }),
      )
      expect(selectorLayout[1].top).toBeGreaterThan(selectorLayout[0].top + 4)
      const oneColumnGrid = await page.locator('.myxi-slots').evaluate((node) => {
        const style = window.getComputedStyle(node)
        return style.gridTemplateColumns.split(' ').filter(Boolean).length
      })
      expect(oneColumnGrid).toBe(1)

      await page.setViewportSize({ width: 1480, height: 900 })
      await page.reload()
      await expect(
        page.locator('.myxi-slots .player-chip.slot-chip.compact').nth(1),
      ).toBeVisible()
      const twoColumnGrid = await page.locator('.myxi-slots').evaluate((node) => {
        const style = window.getComputedStyle(node)
        return style.gridTemplateColumns.split(' ').filter(Boolean).length
      })
      expect(twoColumnGrid).toBe(2)
      const selectedCaptainText = await captainSelect.evaluate(
        (node) => node.selectedOptions?.[0]?.textContent?.trim() || '',
      )
      const selectedViceCaptainText = await viceCaptainSelect.evaluate(
        (node) => node.selectedOptions?.[0]?.textContent?.trim() || '',
      )
      expect(selectedCaptainText).not.toBe('Select C')
      expect(selectedViceCaptainText).not.toBe('Select VC')
      expect(selectedCaptainText).not.toContain('(')
      expect(selectedViceCaptainText).not.toContain('(')
      expect(selectedCaptainText.length).toBeGreaterThan(2)
      expect(selectedViceCaptainText.length).toBeGreaterThan(2)
      await captainSelect.selectOption({ index: 2 })
      const updatedCaptainText = await captainSelect.evaluate(
        (node) => node.selectedOptions?.[0]?.textContent?.trim() || '',
      )
      expect(updatedCaptainText).not.toBe(selectedCaptainText)
      expect(updatedCaptainText.length).toBeGreaterThan(2)
      const selectedCaptainValue = await captainSelect.evaluate((node) => node.value)
      const conflictingViceOptionDisabled = await viceCaptainSelect.evaluate(
        (node, selectedValue) => {
          const option = [...node.options].find((entry) => entry.value === selectedValue)
          return option ? option.disabled : false
        },
        selectedCaptainValue,
      )
      expect(conflictingViceOptionDisabled).toBe(true)
      await captainSelect.selectOption('')
      await expect(
        page.getByText('Captain and vice captain are required before saving.'),
      ).toBeVisible()
    } finally {
      if (contestId) {
        await bestEffortDelete(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          actorUserId: 'master',
        })
      }
      await bestEffortDelete(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        actorUserId: 'master',
      })
    }
  })

  test('promoting a backup player into MyXI removes that player from backups', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-backup-promote-tour-${tag}`
    let contestId = ''

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON Backup Promote Tournament ${tag}`,
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

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Backup Promote Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await loginUi(page, 'player')
      const joinResponse = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.joinContest({ contestId: innerContestId, userId: 'player' })
        },
        { innerContestId: contestId },
      )
      expect(
        joinResponse?.joined || joinResponse?.ok || joinResponse?.contestId,
      ).toBeTruthy()

      const pool = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.fetchTeamPool({
            contestId: innerContestId,
            matchId: 'm1',
            userId: 'player',
          })
        },
        { innerContestId: contestId },
      )
      const backupCandidate = [
        ...(pool?.teams?.teamA?.players || []),
        ...(pool?.teams?.teamB?.players || []),
      ][0]
      expect(backupCandidate).toBeTruthy()

      await loginUi(page, 'player')
      await page.goto(`/fantasy/select?contest=${contestId}&match=m1&mode=add`)

      const playerTile = page
        .locator('.player-tile', { hasText: backupCandidate.name })
        .first()
      await expect(playerTile).toBeVisible()
      await playerTile.getByRole('button', { name: 'B' }).click()
      await expect(
        page.locator('.backups-grid', { hasText: backupCandidate.name }),
      ).toBeVisible()

      await playerTile.getByRole('button', { name: '+' }).click()
      await expect(
        page.locator('.myxi-slots', { hasText: backupCandidate.name }),
      ).toBeVisible()
      await expect(
        page.locator('.backups-grid', { hasText: backupCandidate.name }),
      ).toHaveCount(0)
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('desktop preview gives MyXI more height than backups without body scroll', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-preview-layout-tour-${tag}`
    let contestId = ''
    const bestEffortDelete = async (url, data) => {
      await Promise.race([
        request.fetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data,
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]).catch(() => {})
    }

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON Preview Layout Tournament ${tag}`,
          season: '2026',
          source: 'json',
          tournamentType: 'league',
          country: 'india',
          league: 'IPL',
          selectedTeams: ['MI', 'KKR'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'MI',
              away: 'KKR',
              startAt: '2099-03-10T14:00:00.000Z',
              timezone: 'UTC',
              venue: 'Mumbai',
            },
          ],
        },
        201,
      )

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Preview Layout Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: 'player' },
        200,
      )

      const pool = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=m1&userId=player`,
        undefined,
        200,
      )
      const playingXi = buildValidPlayingXi(
        pool?.teams?.teamA?.players || [],
        pool?.teams?.teamB?.players || [],
      )
      const backupIds = [
        ...(pool?.teams?.teamA?.players || []),
        ...(pool?.teams?.teamB?.players || []),
      ]
        .map((player) => player.id)
        .filter((id) => !playingXi.includes(id))
        .slice(0, 6)
      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'm1',
          userId: 'player',
          playingXi,
          backups: backupIds,
          captainId: playingXi[0],
          viceCaptainId: playingXi[1],
        },
        200,
      )

      await page.setViewportSize({ width: 1024, height: 900 })
      await loginUi(page, 'player')
      await page.goto(`/fantasy/select?contest=${contestId}&match=m1&mode=edit`)
      await page.getByRole('button', { name: /Preview/i }).click()

      const modal = page.locator('.ui-modal-card.team-preview-modal')
      await expect(modal).toBeVisible()
      await expect(page.locator('.team-preview-column .myxi-card')).toBeVisible()
      await expect(page.locator('.team-preview-column .backups-card')).toBeVisible()
      const modalWidth = await modal.evaluate((node) => node.clientWidth)
      expect(modalWidth).toBeGreaterThan(500)

      const myxiHeight = await page
        .locator('.team-preview-column .myxi-card')
        .evaluate((node) => node.clientHeight)
      const backupsHeight = await page
        .locator('.team-preview-column .backups-card')
        .evaluate((node) => node.clientHeight)
      expect(myxiHeight).toBeGreaterThan(backupsHeight)
      expect(myxiHeight / backupsHeight).toBeGreaterThan(1.8)

      const bodyMetrics = await page
        .locator('.team-preview-modal .ui-modal-body')
        .evaluate((node) => ({
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight,
          overflowY: window.getComputedStyle(node).overflowY,
        }))
      expect(bodyMetrics.overflowY).toBe('hidden')
      expect(bodyMetrics.scrollHeight).toBeLessThanOrEqual(bodyMetrics.clientHeight + 2)
    } finally {
      if (contestId) {
        await bestEffortDelete(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          actorUserId: 'master',
        })
      }
      await bestEffortDelete(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        actorUserId: 'master',
      })
    }
  })

  test('save stays clickable at 11 players and shows wicketkeeper requirement when role mix is invalid', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-save-gating-tour-${tag}`
    let contestId = ''
    const bestEffortDelete = async (url, data) => {
      await Promise.race([
        request.fetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data,
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]).catch(() => {})
    }

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON Save Gating Tournament ${tag}`,
          season: '2026',
          source: 'json',
          tournamentType: 'league',
          country: 'india',
          league: 'IPL',
          selectedTeams: ['MI', 'KKR'],
          matches: [
            {
              id: 'm1',
              matchNo: 1,
              home: 'MI',
              away: 'KKR',
              startAt: '2099-03-10T14:00:00.000Z',
              timezone: 'UTC',
              venue: 'Mumbai',
            },
          ],
        },
        201,
      )

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Save Gating Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: 'player' },
        200,
      )

      const pool = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=m1&userId=player`,
        undefined,
        200,
      )
      const allPlayers = [
        ...(pool?.teams?.teamA?.players || []),
        ...(pool?.teams?.teamB?.players || []),
      ]
      const invalidXi = allPlayers
        .filter((player) => player.role !== 'WK')
        .slice(0, 11)
        .map((player) => player.id)
      expect(invalidXi.length).toBe(11)

      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'm1',
          userId: 'player',
          playingXi: invalidXi,
          backups: [],
          captainId: invalidXi[0],
          viceCaptainId: invalidXi[1],
        },
        200,
      )

      await loginUi(page, 'player')
      await page.goto(`/fantasy/select?contest=${contestId}&match=m1&mode=edit`)

      await expect(page.locator('.count-pill')).toContainText('11 / 11')
      await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText('Select at least 1 wicketkeeper.')).toBeVisible()
    } finally {
      if (contestId) {
        await bestEffortDelete(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          actorUserId: 'master',
        })
      }
      await bestEffortDelete(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        actorUserId: 'master',
      })
    }
  })

  test('edit mode restores the saved custom XI and backups even when selection ids come back as strings', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-restore-team-tour-${tag}`
    let contestId = ''
    const bestEffortDelete = async (url, data) => {
      await Promise.race([
        request.fetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data,
        }),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]).catch(() => {})
    }

    try {
      await loginUi(page, 'master')
      const createdTournament = await page.evaluate(
        async ({ tournamentId: innerTournamentId, tag: innerTag }) => {
          const api = await import('/src/lib/api.js')
          return api.createAdminTournament({
            actorUserId: 'master',
            tournamentId: innerTournamentId,
            name: `JSON Restore Team Tournament ${innerTag}`,
            season: '2026',
            source: 'json',
            tournamentType: 'league',
            country: 'india',
            league: 'IPL',
            selectedTeams: ['MI', 'KKR'],
            matches: [
              {
                id: 'm1',
                matchNo: 1,
                home: 'MI',
                away: 'KKR',
                startAt: '2099-03-10T14:00:00.000Z',
                timezone: 'UTC',
                venue: 'Mumbai',
              },
            ],
          })
        },
        { tournamentId, tag },
      )
      expect(createdTournament?.tournament?.id || createdTournament?.id).toBeTruthy()

      const contest = await page.evaluate(
        async ({ innerTournamentId, innerTag }) => {
          const api = await import('/src/lib/api.js')
          return api.createAdminContest({
            name: `JSON Restore Team Contest ${innerTag}`,
            tournamentId: innerTournamentId,
            game: 'Fantasy',
            teams: 25,
            status: 'Open',
            createdBy: 'master',
            matchIds: ['m1'],
          })
        },
        { innerTournamentId: tournamentId, innerTag: tag },
      )
      contestId = contest?.contest?.id || contest?.id

      await loginUi(page, 'player')
      const joinResponse = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.joinContest({ contestId: innerContestId, userId: 'player' })
        },
        { innerContestId: contestId },
      )
      expect(
        joinResponse?.joined || joinResponse?.ok || joinResponse?.contestId,
      ).toBeTruthy()

      const pool = await page.evaluate(
        async ({ innerContestId }) => {
          const api = await import('/src/lib/api.js')
          return api.fetchTeamPool({
            contestId: innerContestId,
            matchId: 'm1',
            userId: 'player',
          })
        },
        { innerContestId: contestId },
      )
      const teamAPlayers = pool?.teams?.teamA?.players || []
      const teamBPlayers = pool?.teams?.teamB?.players || []
      const allPlayers = [...teamAPlayers, ...teamBPlayers]
      const playingXi = buildValidPlayingXi(teamAPlayers, teamBPlayers)
      const selectedIds = new Set(playingXi)
      const selectedPlayers = playingXi
        .map((id) => allPlayers.find((player) => player.id === id))
        .filter(Boolean)
      const roleCounts = selectedPlayers.reduce((acc, player) => {
        acc[player.role] = (acc[player.role] || 0) + 1
        return acc
      }, {})
      const replacement = allPlayers.find((candidate) => {
        if (!candidate || selectedIds.has(candidate.id)) return false
        const removable = selectedPlayers.find(
          (player) =>
            player.team === candidate.team &&
            player.role === candidate.role &&
            (roleCounts[player.role] || 0) > 1,
        )
        if (!removable) return false
        selectedIds.delete(removable.id)
        selectedIds.add(candidate.id)
        return true
      })
      expect(replacement).toBeTruthy()
      const replacementTarget = selectedPlayers.find(
        (player) =>
          player.team === replacement.team &&
          player.role === replacement.role &&
          (roleCounts[player.role] || 0) > 1,
      )
      expect(replacementTarget).toBeTruthy()
      const customPlayingXi = selectedPlayers.map((player) =>
        player.id === replacementTarget.id ? replacement.id : player.id,
      )
      const customBackups = allPlayers
        .filter((player) => !customPlayingXi.includes(player.id))
        .slice(-6)
        .map((player) => player.id)
      const customPlayingNames = customPlayingXi
        .map((id) => allPlayers.find((player) => player.id === id)?.name)
        .filter(Boolean)
      const customBackupNames = customBackups
        .map((id) => allPlayers.find((player) => player.id === id)?.name)
        .filter(Boolean)

      const savedSelection = await page.evaluate(
        async ({ innerContestId, customXi, customBackupIds }) => {
          const api = await import('/src/lib/api.js')
          return api.saveTeamSelection({
            contestId: innerContestId,
            matchId: 'm1',
            userId: 'player',
            playingXi: customXi,
            backups: customBackupIds,
            captainId: customXi[0],
            viceCaptainId: customXi[1],
          })
        },
        {
          innerContestId: contestId,
          customXi: customPlayingXi,
          customBackupIds: customBackups,
        },
      )
      expect(
        savedSelection?.playingXi || savedSelection?.selection?.playingXi,
      ).toBeTruthy()

      await page.route(
        `**/team-pool?contestId=${contestId}&matchId=m1&userId=player**`,
        async (route) => {
          const response = await route.fetch()
          const json = await response.json()
          const selection = json?.selection || {}
          await route.fulfill({
            response,
            json: {
              ...json,
              selection: {
                ...selection,
                playingXi: Array.isArray(selection.playingXi)
                  ? selection.playingXi.map((id) => String(id))
                  : [],
                backups: Array.isArray(selection.backups)
                  ? selection.backups.map((id) => String(id))
                  : [],
                captainId:
                  selection.captainId == null ? null : String(selection.captainId),
                viceCaptainId:
                  selection.viceCaptainId == null
                    ? null
                    : String(selection.viceCaptainId),
              },
            },
          })
        },
      )
      await page.goto(`/fantasy/select?contest=${contestId}&match=m1&mode=edit`)

      await expect(page.locator('.count-pill')).toContainText('11 / 11')
      await expect(
        page.locator('.myxi-slots .player-chip.slot-chip.compact'),
      ).toHaveCount(11)
      await expect(
        page.locator('.backups-grid .player-chip.slot-chip.compact'),
      ).toHaveCount(customBackups.length)
      await expect(page.locator('.myxi-slots')).toContainText(customPlayingNames[0])
      await expect(page.locator('.myxi-slots')).toContainText(customPlayingNames[10])
      await expect(page.locator('.backups-grid')).toContainText(customBackupNames[0])
      await expect(page.locator('.backups-grid')).toContainText(
        customBackupNames[customBackupNames.length - 1],
      )
      await expect(page.locator('.myxi-slots')).not.toContainText(replacementTarget.name)
      await expect(page.locator('.myxi-slots')).toContainText(replacement.name)
    } finally {
      if (contestId) {
        await bestEffortDelete(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          actorUserId: 'master',
        })
      }
      await bestEffortDelete(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        actorUserId: 'master',
      })
    }
  })

  test('non-playing selected player is replaced by backup and captain bonus does not transfer', async ({
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-backup-tour-${tag}`
    let contestId = ''

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON Backup Tournament ${tag}`,
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

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Backup Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: 'player' },
        200,
      )

      const pool = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=m1&userId=player`,
        undefined,
        200,
      )
      const teamAPlayers = pool?.teams?.teamA?.players || []
      const teamBPlayers = pool?.teams?.teamB?.players || []
      const playingXi = buildValidPlayingXi(teamAPlayers, teamBPlayers)
      const allPlayers = [...teamAPlayers, ...teamBPlayers]
      const playerById = new Map(allPlayers.map((player) => [player.id, player]))
      const captainId = playingXi[0]
      const viceCaptainId = playingXi[1]
      const captain = playerById.get(captainId)
      const viceCaptain = playerById.get(viceCaptainId)
      const backupId = allPlayers
        .filter(
          (player) => !playingXi.includes(player.id) && player.team === captain?.team,
        )
        .map((player) => player.id)[0]
      const backup = playerById.get(backupId)
      expect(backup?.team).toBe(captain?.team)

      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'm1',
          userId: 'player',
          playingXi,
          backups: [backupId],
          captainId,
          viceCaptainId,
        },
        200,
      )

      const teamAName = pool?.teams?.teamA?.name || 'IND'
      const teamBName = pool?.teams?.teamB?.name || 'AUS'
      const buildLineup = (teamName, forcedOutName, forcedInPlayer) => {
        const squadSource = teamName === teamAName ? teamAPlayers : teamBPlayers
        const withoutForcedOut = squadSource
          .map((player) => player.name)
          .filter((name) => name !== forcedOutName)
        const playingNames = withoutForcedOut.slice(0, 11)
        if (
          forcedInPlayer?.team === teamName &&
          !playingNames.includes(forcedInPlayer.name)
        ) {
          playingNames.pop()
          playingNames.push(forcedInPlayer.name)
        }
        return {
          squad: squadSource.map((player) => player.name),
          playingXI: playingNames,
          bench: squadSource
            .map((player) => player.name)
            .filter((name) => !playingNames.includes(name)),
        }
      }

      await apiCall(
        request,
        'POST',
        '/admin/match-lineups/upsert',
        {
          tournamentId,
          matchId: 'm1',
          updatedBy: 'master',
          lineups: {
            [teamAName]: buildLineup(
              teamAName,
              captain?.team === teamAName ? captain.name : '',
              backup?.team === teamAName ? backup : null,
            ),
            [teamBName]: buildLineup(
              teamBName,
              captain?.team === teamBName ? captain.name : '',
              backup?.team === teamBName ? backup : null,
            ),
          },
        },
        200,
      )

      await apiCall(
        request,
        'POST',
        '/admin/match-scores/upsert',
        {
          tournamentId,
          matchId: 'm1',
          userId: 'master',
          playerStats: [
            {
              playerId: captain.id,
              playerName: captain.name,
              runs: 20,
            },
            {
              playerId: viceCaptain.id,
              playerName: viceCaptain.name,
              runs: 10,
            },
            {
              playerId: backup.id,
              playerName: backup.name,
              runs: 10,
            },
          ],
        },
        200,
      )

      const leaderboard = await apiCall(
        request,
        'GET',
        `/contests/${contestId}/leaderboard`,
        undefined,
        200,
      )
      const playerRow = (leaderboard.rows || []).find((row) => row.userId === 'player')
      expect(Number(playerRow?.points || 0)).toBe(25)
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })

  test('team selection locks imported matches after scheduled start time', async ({
    page,
    request,
  }) => {
    const tag = Date.now()
    const tournamentId = `json-lock-tour-${tag}`
    let contestId = ''

    try {
      await apiCall(
        request,
        'POST',
        '/admin/tournaments',
        {
          actorUserId: 'master',
          tournamentId,
          name: `JSON Lock Tournament ${tag}`,
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
              startAt: '2099-03-01T19:30',
              timezone: 'Asia/Kolkata',
              venue: 'Bengaluru',
            },
            {
              id: 'm2',
              matchNo: 2,
              home: 'RCB',
              away: 'SRH',
              startAt: '2026-03-01T19:30',
              timezone: 'Asia/Kolkata',
              venue: 'Bengaluru',
            },
          ],
        },
        201,
      )

      const contest = await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: `JSON Lock Contest ${tag}`,
          tournamentId,
          game: 'Fantasy',
          teams: 25,
          status: 'Open',
          joined: true,
          createdBy: 'master',
          matchIds: ['m1'],
        },
        201,
      )
      contestId = contest.id

      await loginUi(page, 'master')
      await page.goto(`/fantasy/select?contest=${contestId}&match=m2&mode=add`)

      await expect(page.getByText('Match locked')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Locked' })).toBeDisabled()
      await expect(page.locator('.player-tile button:enabled')).toHaveCount(0)
    } finally {
      if (contestId) {
        await request.fetch(`http://127.0.0.1:4000/admin/contests/${contestId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: 'master' },
        })
      }
      await request.fetch(`http://127.0.0.1:4000/admin/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        data: { actorUserId: 'master' },
      })
    }
  })
})
