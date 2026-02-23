import { expect, test } from '@playwright/test'
import { apiCall, loginUi } from './helpers/mock-e2e.js'

const buildTeamCode = (tag) => `J${String(tag).slice(-5)}`

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
          { name: `json-player-a-${tag}`, country: 'pakistan', role: 'BAT', active: true },
          { name: `json-player-b-${tag}`, country: 'pakistan', role: 'BOWL', active: true },
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
      await expect(page.getByRole('button', { name: 'Admin Manager' })).toBeVisible()

      const catalog = await apiCall(request, 'GET', '/admin/tournaments/catalog', undefined, 200)
      expect((catalog || []).some((row) => row.id === tournamentId)).toBe(true)

      await page.goto('/home')
      await page.getByRole('button', { name: 'Admin Manager' }).click()
      await page.getByRole('tab', { name: /Tournaments \(/ }).click()
      await expect(page.locator('.catalog-table tbody tr', { hasText: tournamentName })).toBeVisible()

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
      const contestCard = page.locator('article.compact-contest-card', { hasText: contestName }).first()
      await expect(contestCard).toBeVisible()
      await contestCard.getByRole('link', { name: 'Open contest' }).click()
      await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}/contests/${contestId}$`))

      await page.goto('/home')
      await page.getByRole('button', { name: 'Admin Manager' }).click()
      await page.getByRole('tab', { name: 'Contests' }).click()
      await page.locator('.contest-section-head select').first().selectOption(tournamentId)
      await expect(page.locator('.catalog-table tbody tr', { hasText: contestName })).toBeVisible()
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
    const beforeByUserId = new Map((beforeLeaderboard?.rows || []).map((row) => [row.userId, Number(row.points || 0)]))

    await loginUi(page, 'master')
    await page.goto('/home')
    await page.getByRole('button', { name: 'Score Updates' }).click()
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
    await page.locator('.match-upload-json textarea').fill(JSON.stringify(payload, null, 2))
    await page.locator('.upload-actions .upload-action-btn.primary').click()
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
    expect(Number(afterSurya.points || 0)).toBeGreaterThan(Number(beforeSurya?.points || 0))

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
    await expect(page.locator('.cricketer-stats-table tbody tr', { hasText: 'Suryakumar Yadav' }).first()).toBeVisible()

    await page.goto('/tournaments/t20wc-2026/contests/huntercherry/leaderboard')
    await expect(page.locator('.leaderboard-table tbody tr').first()).toBeVisible()
  })
})
