import { expect, test } from '@playwright/test'
import { apiCall, deleteContestIfPresent, loginUi } from './helpers/mock-e2e.js'

test.describe('19) Fixed-roster IPL auction contest', () => {
  test.setTimeout(90_000)

  test('auction hub shows NWMSU-IPL-AUCTION and keeps it out of normal fantasy discovery', async ({
    page,
  }) => {
    await loginUi(page, 'master')

    await page.goto('/fantasy')
    await page.locator('.tournament-card', { hasText: 'IPL 2026' }).click()
    await expect(
      page.locator('.compact-contest-card', { hasText: 'NWMSU-IPL-AUCTION' }),
    ).toHaveCount(0)

    await page.getByRole('navigation').getByRole('link', { name: 'Auction' }).click()
    await expect(page).toHaveURL(/\/auction/)
    await expect(page.getByText('Scores update every minute')).toHaveCount(0)
    await expect(
      page.getByText(
        'Browse imported contests and follow squads, matches, and leaderboard in one place.',
      ),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Track external auctions without mixing them into normal fantasy joins.',
      ),
    ).toHaveCount(0)
    await page.locator('.tournament-card', { hasText: 'IPL 2026' }).click()

    const contestCard = page.locator('.compact-contest-card', {
      hasText: 'NWMSU-IPL-AUCTION',
    })
    await expect(contestCard).toBeVisible()
    await expect(contestCard).toContainText(/Open|Starting Soon|In Progress/)
    await expect(contestCard).toContainText('Fixed 15-player tournament rosters')
    await expect(contestCard).toContainText('Leaderboard counts top 11 scoring players')

    await contestCard.getByRole('link', { name: 'Open contest' }).click()
    await expect(page).toHaveURL(
      /\/tournaments\/ipl-2026\/contests\/nwmsu-ipl-auction\?view=auction/,
    )
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Auction' }),
    ).toHaveClass(/active/)
    await expect(page.locator('.flow-breadcrumb').first()).toContainText('Auction')
    const firstMatchRow = page.locator('.match-table tbody tr').first()
    await expect(firstMatchRow).toBeVisible()
    await expect(firstMatchRow).toContainText(/\d{1,2}:\d{2}/)
    await expect(firstMatchRow).toContainText(/Not Started|In Progress|Completed/)
    const participantCardHeight = await page
      .locator('.participants-card')
      .evaluate((node) => Math.round(node.getBoundingClientRect().height))
    expect(participantCardHeight).toBeLessThan(520)
    await expect(
      page.locator('.participants-table tbody tr', { hasText: 'HunterCherryXI' }),
    ).toBeVisible()
    await expect(
      page.locator('.participants-table tbody tr', { hasText: 'Draker' }),
    ).toBeVisible()
  })

  test('fixed-roster match preview is read-only and filtered to the selected match', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/auction')
    await page.locator('.tournament-card', { hasText: 'IPL 2026' }).click()
    await page
      .locator('.compact-contest-card', { hasText: 'NWMSU-IPL-AUCTION' })
      .getByRole('link', { name: 'Open contest' })
      .click()

    const targetMatchRow = page.locator('.match-table tbody tr').nth(1)
    await expect(targetMatchRow).toBeVisible()
    await expect(targetMatchRow).toContainText('Match 2')
    await expect(targetMatchRow.getByLabel(/Edit team|Add team/i)).toHaveCount(0)
    await targetMatchRow.click()

    const participantRow = page
      .locator('.participants-table tbody tr', { hasText: 'HunterCherryXI' })
      .first()
    await expect(participantRow).toBeVisible()
    await expect(participantRow.getByRole('link', { name: /Edit .* team/i })).toHaveCount(
      0,
    )
    await participantRow.getByRole('button', { name: 'View HunterCherryXI team' }).click()

    await expect(page.locator('.team-preview-panel')).toContainText(
      'HunterCherryXI roster',
    )
    await expect(page.locator('.team-preview-panel')).toContainText(
      'Leaderboard counts the top 11 scoring roster players.',
    )
    await expect(page.locator('.team-preview-list').first()).toContainText(
      'Krunal Pandya',
    )
    await expect(page.locator('.team-preview-list').first()).toContainText(
      'Ajinkya Rahane',
    )
    await expect(page.locator('.team-preview-list').first()).toContainText('Philip Salt')
    await expect(
      page
        .locator('.team-preview-list')
        .first()
        .locator('img[src*="cricapi.com"]')
        .first(),
    ).toBeVisible()
    await expect(
      page.locator('.team-preview-list').first().locator('.team-preview-row'),
    ).toHaveCount(3)
    await expect(page.locator('.team-preview-panel')).toContainText('Other owned players')
    const previewSectionHeights = await page
      .locator('.team-preview-section')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
    expect(previewSectionHeights).toHaveLength(2)
    expect(previewSectionHeights[0]).toBeGreaterThan(previewSectionHeights[1])
    expect(previewSectionHeights[0] / previewSectionHeights[1]).toBeGreaterThan(1.8)

    await page
      .locator('.team-preview-panel')
      .getByRole('button', { name: 'Close' })
      .click()

    await page.getByRole('button', { name: 'Preview leaderboard' }).click()
    await expect(
      page.locator('.leaderboard-table tbody tr', { hasText: 'HunterCherryXI' }),
    ).toBeVisible()
    await expect(
      page.locator('.leaderboard-table tbody tr', { hasText: 'Draker' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Open leaderboard page' }).click()
    await expect(page).toHaveURL(
      /\/tournaments\/ipl-2026\/contests\/nwmsu-ipl-auction\/leaderboard/,
    )
    await expect(page.locator('.module-filters select').nth(1)).toHaveValue(
      'nwmsu-ipl-auction',
    )
    await expect(page.locator('.leaderboard-table tbody tr')).toHaveCount(2)

    await page
      .locator('.tournament-page-tabs')
      .getByRole('link', { name: 'Stats' })
      .click()
    await expect(page).toHaveURL(
      /\/tournaments\/ipl-2026\/cricketer-stats\?view=auction&contestId=nwmsu-ipl-auction/,
    )

    await page
      .locator('.tournament-page-tabs')
      .getByRole('link', { name: 'Leaderboard' })
      .click()
    await expect(page).toHaveURL(
      /\/tournaments\/ipl-2026\/contests\/nwmsu-ipl-auction\/leaderboard\?view=auction&contestId=nwmsu-ipl-auction/,
    )
    await expect(page.locator('.module-filters select').nth(1)).toHaveValue(
      'nwmsu-ipl-auction',
    )
  })

  test('auction allows any logged-in user to view another participant roster', async ({
    page,
  }) => {
    await loginUi(page, 'draker')
    await page.goto('/auction')
    await page.locator('.tournament-card', { hasText: 'IPL 2026' }).click()
    await page
      .locator('.compact-contest-card', { hasText: 'NWMSU-IPL-AUCTION' })
      .getByRole('link', { name: 'Open contest' })
      .click()

    const participantRow = page
      .locator('.participants-table tbody tr', { hasText: 'HunterCherryXI' })
      .first()
    await expect(participantRow).toBeVisible()
    await participantRow.getByRole('button', { name: 'View HunterCherryXI team' }).click()

    await expect(page.locator('.team-preview-panel')).toContainText(
      'HunterCherryXI roster',
    )
    const previewCount = await page
      .locator('.team-preview-list')
      .first()
      .locator('.team-preview-row')
      .count()
    expect(previewCount).toBeGreaterThan(0)
    await expect(
      page.getByText('Only master admin can access another user full team.'),
    ).toHaveCount(0)
  })

  test('ipl stats stay scoped to ipl squads and show franchise teams', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/auction')
    const tournamentCard = page.locator('.tournament-card', { hasText: 'IPL 2026' })
    await tournamentCard.click()
    await tournamentCard.getByRole('link', { name: 'Stats', exact: true }).click()

    await expect(page).toHaveURL(/\/tournaments\/ipl-2026\/cricketer-stats/)
    await expect(page.locator('.cricketer-stats-table')).toContainText('Mumbai Indians')
    await expect(page.locator('.cricketer-stats-table')).toContainText('MI')
    await expect(page.locator('.cricketer-stats-table')).toContainText('CSK')
    await expect(page.locator('.cricketer-stats-table')).toContainText('Gujarat Titans')
    await expect(page.locator('.cricketer-stats-table')).toContainText('GT')
    await expect(page.locator('.cricketer-stats-table')).not.toContainText('Afghanistan')
    await expect(page.locator('.cricketer-stats-table')).not.toContainText('Rashid Khan')

    const fallbackAvatar = page
      .locator('.player-avatar:has(.player-avatar-fallback)')
      .first()
    await expect(fallbackAvatar).toBeVisible()
    const fallbackCentered = await fallbackAvatar.evaluate((node) => {
      const avatarRect = node.getBoundingClientRect()
      const fallback = node.querySelector('.player-avatar-fallback')
      if (!fallback) return false
      const fallbackRect = fallback.getBoundingClientRect()
      const centerDiffX = Math.abs(
        avatarRect.left +
          avatarRect.width / 2 -
          (fallbackRect.left + fallbackRect.width / 2),
      )
      const centerDiffY = Math.abs(
        avatarRect.top +
          avatarRect.height / 2 -
          (fallbackRect.top + fallbackRect.height / 2),
      )
      return centerDiffX <= 1 && centerDiffY <= 1
    })
    expect(fallbackCentered).toBeTruthy()
  })

  test('admin managing shows the auction contest in the IPL catalog', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/admin/dashboard')

    await page.getByRole('tab', { name: 'Contests' }).click()
    await page.locator('.admin-manager-panel select').first().selectOption('ipl-2026')
    await page.getByRole('button', { name: 'Refresh contests' }).click()

    const auctionRow = page.locator('.catalog-table tbody tr', {
      hasText: 'NWMSU-IPL-AUCTION',
    })
    await expect(auctionRow).toBeVisible()
    await expect(auctionRow).toContainText('Auction')
  })

  test('score updates scope scores by tournament and match without a type filter', async ({
    page,
  }) => {
    await loginUi(page, 'master')
    await page.goto('/admin/dashboard')

    await page.getByRole('button', { name: 'Score Manager' }).click()
    const panel = page.locator('.match-scores-panel')
    await expect(panel).toBeVisible()
    await expect(panel.locator('label', { hasText: /^Type$/ })).toHaveCount(0)

    const selects = panel.locator('.manual-scope-row select')
    await expect(selects).toHaveCount(2)
    await selects.nth(0).selectOption('ipl-2026')

    await expect(selects.nth(1).locator('option')).toHaveCount(5)
    await expect(selects.nth(1)).toContainText('MI vs CSK')
    await expect(selects.nth(1)).toContainText('RCB vs KKR')
  })

  test('one IPL score upload updates stats and the auction leaderboard everywhere', async ({
    page,
    request,
  }) => {
    await apiCall(
      request,
      'POST',
      '/admin/match-scores/upsert',
      {
        tournamentId: 'ipl-2026',
        contestId: 'nwmsu-ipl-auction',
        matchId: 'ipl-m1',
        userId: 'master',
        playerStats: [
          {
            playerId: 'csk-p9',
            playerName: 'Ruturaj Gaikwad',
            runs: 74,
            fours: 8,
            sixes: 3,
            wickets: 0,
            catches: 0,
          },
          {
            playerId: 'mi-p7',
            playerName: 'Trent Boult',
            runs: 0,
            wickets: 2,
            maidens: 1,
            catches: 1,
          },
          {
            playerId: 'mi-p2',
            playerName: 'Shardul Thakur',
            runs: 12,
            fours: 1,
            wickets: 1,
            catches: 0,
          },
        ],
      },
      200,
    )

    await loginUi(page, 'master')
    await page.goto('/tournaments/ipl-2026/cricketer-stats?view=auction')

    const ruturajRow = page.locator('.cricketer-stats-table tbody tr', {
      hasText: 'Ruturaj Gaikwad',
    })
    await expect(ruturajRow).toBeVisible()
    await expect(ruturajRow).toContainText('CSK')
    const ruturajPoints = await ruturajRow.locator('td').last().textContent()
    expect(Number(ruturajPoints || 0)).toBeGreaterThan(0)

    await page.goto(
      '/tournaments/ipl-2026/contests/nwmsu-ipl-auction/leaderboard?view=auction',
    )
    const leaderboardRows = page.locator('.leaderboard-table tbody tr')
    await expect(leaderboardRows).toHaveCount(2)
    await expect(leaderboardRows.nth(0)).toContainText('HunterCherryXI')
    await expect(leaderboardRows.nth(1)).toContainText('Draker')

    const firstPoints = await leaderboardRows.nth(0).locator('td').last().textContent()
    const secondPoints = await leaderboardRows.nth(1).locator('td').last().textContent()
    expect(Number(firstPoints || 0)).toBeGreaterThan(Number(secondPoints || 0))
  })

  test('auction fixed-roster leaderboard counts only the top 11 scoring players', async ({
    page,
    request,
  }) => {
    await loginUi(page, 'master')
    const scoreResponse = await page.evaluate(
      async (payload) => {
        const raw = window.localStorage.getItem('myxi-user')
        const token = raw ? JSON.parse(raw)?.token || '' : ''
        const response = await fetch('http://127.0.0.1:4000/admin/match-scores/upsert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        })
        return {
          status: response.status,
          body: await response.text(),
        }
      },
      {
        tournamentId: 'ipl-2026',
        contestId: 'nwmsu-ipl-auction',
        matchId: 'ipl-m1',
        userId: 'master',
        playerStats: [
          {
            playerId: 'csk-p9',
            playerName: 'Ruturaj Gaikwad',
            runs: 30,
            fours: 2,
            sixes: 1,
            wickets: 0,
            catches: 0,
          },
          {
            playerId: 'csk-p4',
            playerName: 'Shivam Dube',
            runs: 25,
            fours: 2,
            sixes: 1,
            wickets: 0,
            catches: 0,
          },
          {
            playerId: 'csk-p2',
            playerName: 'Ravindra Jadeja',
            runs: 20,
            fours: 1,
            sixes: 0,
            wickets: 1,
            catches: 0,
          },
          {
            playerId: 'mi-p7',
            playerName: 'Trent Boult',
            runs: 0,
            wickets: 2,
            maidens: 1,
            catches: 0,
          },
          {
            playerId: 'mi-p8',
            playerName: 'Jasprit Bumrah',
            runs: 0,
            wickets: 2,
            maidens: 0,
            catches: 0,
          },
          {
            playerId: 'mi-p4',
            playerName: 'Tilak Varma',
            runs: 18,
            fours: 1,
            sixes: 1,
            wickets: 0,
            catches: 0,
          },
          {
            playerId: 'mi-p2',
            playerName: 'Rohit Sharma',
            runs: 15,
            fours: 1,
            sixes: 0,
            wickets: 0,
            catches: 0,
          },
          {
            playerId: 'mi-p10',
            playerName: 'Hardik Pandya',
            runs: 10,
            wickets: 1,
            catches: 0,
          },
          {
            playerId: 'mi-p1',
            playerName: 'Suryakumar Yadav',
            runs: 12,
            fours: 1,
            sixes: 0,
            wickets: 0,
            catches: 0,
          },
          {
            playerId: 'csk-p1',
            playerName: 'Rachin Ravindra',
            runs: 11,
            fours: 1,
            sixes: 0,
            wickets: 0,
            catches: 0,
          },
          {
            playerId: 'mi-p3',
            playerName: 'Ryan Rickelton',
            runs: 9,
            fours: 1,
            sixes: 0,
            wickets: 0,
            catches: 0,
          },
          {
            playerId: 'csk-p8',
            playerName: 'Noor Ahmad',
            runs: 0,
            wickets: 1,
            catches: 0,
          },
        ],
      },
    )
    expect(scoreResponse.status).toBe(200)

    const leaderboard = await apiCall(
      request,
      'GET',
      '/contests/nwmsu-ipl-auction/leaderboard',
      undefined,
      200,
    )
    const hunterRow = (leaderboard || []).find((row) => row.gameName === 'HunterCherryXI')
    expect(hunterRow).toBeTruthy()
    expect(Number(hunterRow.points || 0)).toBeGreaterThan(0)
    expect(Number(hunterRow.countedPlayers || 0)).toBe(11)
    expect(Number(hunterRow.rosterSize || 0)).toBe(15)
  })

  test('the same IPL score upload also updates a regular fantasy contest on the shared roster', async ({
    page,
    request,
  }) => {
    let contestId = ''
    try {
      const contestName = `ipl-shared-fantasy-${Date.now()}`
      contestId = contestName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

      await loginUi(page, 'master')
      await apiCall(
        request,
        'POST',
        '/admin/contests',
        {
          name: contestName,
          tournamentId: 'ipl-2026',
          game: 'Fantasy',
          teams: 20,
          status: 'Open',
          joined: false,
          createdBy: 'master',
          matchIds: ['ipl-m2'],
        },
        201,
      )

      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: 'huntercherryxi' },
        200,
      )
      await apiCall(
        request,
        'POST',
        `/contests/${contestId}/join`,
        { userId: 'draker' },
        200,
      )

      const pool = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=ipl-m2&userId=huntercherryxi`,
        undefined,
        200,
      )
      const teamAPlayers = pool?.teams?.teamA?.players || []
      const teamBPlayers = pool?.teams?.teamB?.players || []
      const allPlayers = [...teamAPlayers, ...teamBPlayers]
      const scoringPlayers = allPlayers.slice(0, 3)
      const scoringIds = scoringPlayers.map((player) => player.id).filter(Boolean)
      const fillerIds = allPlayers
        .map((player) => player.id)
        .filter((id) => !scoringIds.includes(id))
      const hunterXi = [...scoringIds, ...fillerIds.slice(0, 11 - scoringIds.length)]
      const hunterBackups = fillerIds.slice(
        11 - scoringIds.length,
        14 - scoringIds.length,
      )
      const drakerXi = fillerIds.slice(0, 11)
      const drakerBackups = fillerIds.slice(11, 14)

      expect(hunterXi).toHaveLength(11)
      expect(drakerXi).toHaveLength(11)

      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'ipl-m2',
          userId: 'huntercherryxi',
          playingXi: hunterXi,
          backups: hunterBackups,
        },
        200,
      )
      await apiCall(
        request,
        'POST',
        '/team-selection/save',
        {
          contestId,
          matchId: 'ipl-m2',
          userId: 'draker',
          playingXi: drakerXi,
          backups: drakerBackups,
        },
        200,
      )

      await apiCall(
        request,
        'POST',
        '/admin/match-scores/upsert',
        {
          tournamentId: 'ipl-2026',
          contestId,
          matchId: 'ipl-m2',
          userId: 'master',
          playerStats: scoringPlayers.map((player, index) => ({
            playerId: player.id,
            playerName: player.name,
            runs: 20 + index * 12,
            fours: index + 1,
            sixes: index === 0 ? 2 : 0,
            wickets: index === 1 ? 2 : 0,
            maidens: index === 1 ? 1 : 0,
            catches: index === 2 ? 1 : 0,
          })),
        },
        200,
      )

      await loginUi(page, 'master')
      await page.goto(`/tournaments/ipl-2026/contests/${contestId}/leaderboard`)

      const leaderboardRows = page.locator('.leaderboard-table tbody tr')
      await expect(leaderboardRows).toHaveCount(2)
      await expect(leaderboardRows.nth(0)).toContainText(/huntercherryxi/i)
      await expect(leaderboardRows.nth(1)).toContainText(/draker/i)
      const firstPoints = await leaderboardRows.nth(0).locator('td').last().textContent()
      const secondPoints = await leaderboardRows.nth(1).locator('td').last().textContent()
      expect(Number(firstPoints || 0)).toBeGreaterThan(Number(secondPoints || 0))

      await leaderboardRows.nth(0).locator('td').last().getByRole('button').click()
      await expect(
        page.getByRole('heading', { name: /player contributions/i }),
      ).toBeVisible()
      await expect(
        page.getByText(/top 11 roster players by overall contest points/i),
      ).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Playing XI' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Bench' })).toBeVisible()
      await expect(
        page.locator('.leaderboard-breakdown-section').first().locator('tbody tr').first(),
      ).toBeVisible()
    } finally {
      await deleteContestIfPresent(request, contestId)
    }
  })
})
