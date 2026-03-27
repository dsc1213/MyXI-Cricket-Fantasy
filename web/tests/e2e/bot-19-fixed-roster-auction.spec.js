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
      page.getByText('Browse imported contests and follow squads, matches, and leaderboard in one place.'),
    ).toBeVisible()
    await expect(
      page.getByText('Track external auctions without mixing them into normal fantasy joins.'),
    ).toHaveCount(0)
    await page.locator('.tournament-card', { hasText: 'IPL 2026' }).click()

    const contestCard = page.locator('.compact-contest-card', {
      hasText: 'NWMSU-IPL-AUCTION',
    })
    await expect(contestCard).toBeVisible()
    await expect(contestCard).toContainText('Starting Soon')
    await expect(contestCard).toContainText('Fixed 15-player tournament rosters')

    await contestCard.getByRole('link', { name: 'Open contest' }).click()
    await expect(page).toHaveURL(/\/tournaments\/ipl-2026\/contests\/nwmsu-ipl-auction\?view=auction/)
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Auction' })).toHaveClass(
      /active/,
    )
    await expect(page.locator('.flow-breadcrumb').first()).toContainText('Auction')
    await expect(page.locator('.match-table tbody tr').first()).toBeVisible()
    const participantCardHeight = await page.locator('.participants-card').evaluate((node) =>
      Math.round(node.getBoundingClientRect().height),
    )
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
    await expect(participantRow.getByRole('link', { name: /Edit .* team/i })).toHaveCount(0)
    await participantRow.getByRole('button', { name: 'View HunterCherryXI team' }).click()

    await expect(page.locator('.team-preview-panel')).toContainText('HunterCherryXI roster')
    await expect(page.locator('.team-preview-list').first()).toContainText('Krunal Pandya')
    await expect(page.locator('.team-preview-list').first()).toContainText('Ajinkya Rahane')
    await expect(page.locator('.team-preview-list').first()).toContainText('Philip Salt')
    await expect(
      page.locator('.team-preview-list').first().locator('img[src*="cricapi.com"]').first(),
    ).toBeVisible()
    await expect(
      page.locator('.team-preview-list').first().locator('.team-preview-row'),
    ).toHaveCount(3)
    await expect(page.locator('.team-preview-panel')).toContainText('Other owned players')

    await page.locator('.team-preview-panel').getByRole('button', { name: 'Close' }).click()

    await page.getByRole('button', { name: 'Preview leaderboard' }).click()
    await expect(page.locator('.leaderboard-table tbody tr', { hasText: 'HunterCherryXI' })).toBeVisible()
    await expect(page.locator('.leaderboard-table tbody tr', { hasText: 'Draker' })).toBeVisible()
    await page.getByRole('link', { name: 'Open leaderboard page' }).click()
    await expect(page).toHaveURL(/\/tournaments\/ipl-2026\/contests\/nwmsu-ipl-auction\/leaderboard/)
    await expect(page.locator('.module-filters select').nth(1)).toHaveValue('nwmsu-ipl-auction')
    await expect(page.locator('.leaderboard-table tbody tr')).toHaveCount(2)
  })

  test('ipl stats stay scoped to ipl squads and show franchise teams', async ({ page }) => {
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

    const fallbackAvatar = page.locator('.player-avatar:has(.player-avatar-fallback)').first()
    await expect(fallbackAvatar).toBeVisible()
    const fallbackCentered = await fallbackAvatar.evaluate((node) => {
      const avatarRect = node.getBoundingClientRect()
      const fallback = node.querySelector('.player-avatar-fallback')
      if (!fallback) return false
      const fallbackRect = fallback.getBoundingClientRect()
      const centerDiffX = Math.abs(
        avatarRect.left + avatarRect.width / 2 - (fallbackRect.left + fallbackRect.width / 2),
      )
      const centerDiffY = Math.abs(
        avatarRect.top + avatarRect.height / 2 - (fallbackRect.top + fallbackRect.height / 2),
      )
      return centerDiffX <= 1 && centerDiffY <= 1
    })
    expect(fallbackCentered).toBeTruthy()
  })

  test('admin managing shows the auction contest in the IPL catalog', async ({ page }) => {
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

    await page.getByRole('button', { name: 'Score Updates' }).click()
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

    await page.goto('/tournaments/ipl-2026/contests/nwmsu-ipl-auction/leaderboard?view=auction')
    const leaderboardRows = page.locator('.leaderboard-table tbody tr')
    await expect(leaderboardRows).toHaveCount(2)
    await expect(leaderboardRows.nth(0)).toContainText('HunterCherryXI')
    await expect(leaderboardRows.nth(1)).toContainText('Draker')

    const firstPoints = await leaderboardRows
      .nth(0)
      .locator('td')
      .last()
      .textContent()
    const secondPoints = await leaderboardRows
      .nth(1)
      .locator('td')
      .last()
      .textContent()
    expect(Number(firstPoints || 0)).toBeGreaterThan(Number(secondPoints || 0))
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
      await page.goto('/fantasy')
      await page.locator('.tournament-card', { hasText: 'IPL 2026' }).click()
      await page.getByRole('button', { name: '+ Create contest' }).click()
      await page.getByLabel('Tournament').selectOption('ipl-2026')
      await page.getByLabel('Contest name').fill(contestName)
      await page.getByLabel('Max players').fill('20')
      await page.getByRole('button', { name: 'Create', exact: true }).click()
      await expect(
        page.locator('.compact-contest-card', { hasText: contestName }).first(),
      ).toBeVisible()

      await apiCall(request, 'POST', `/contests/${contestId}/join`, { userId: 'huntercherryxi' }, 200)
      await apiCall(request, 'POST', `/contests/${contestId}/join`, { userId: 'draker' }, 200)

      const pool = await apiCall(
        request,
        'GET',
        `/team-pool?contestId=${contestId}&matchId=ipl-m1&userId=huntercherryxi`,
        undefined,
        200,
      )
      const teamAPlayers = pool?.teams?.teamA?.players || []
      const teamBPlayers = pool?.teams?.teamB?.players || []
      const allPlayers = [...teamAPlayers, ...teamBPlayers]
      const pickByName = (name) => allPlayers.find((player) => player.name === name)
      const scoringIds = ['Ruturaj Gaikwad', 'Trent Boult', 'Shardul Thakur']
        .map((name) => pickByName(name)?.id)
        .filter(Boolean)
      const fillerIds = allPlayers
        .map((player) => player.id)
        .filter((id) => !scoringIds.includes(id))
      const hunterXi = [...scoringIds, ...fillerIds.slice(0, 11 - scoringIds.length)]
      const hunterBackups = fillerIds.slice(11 - scoringIds.length, 14 - scoringIds.length)
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
          matchId: 'ipl-m1',
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
          matchId: 'ipl-m1',
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
      await page.goto(`/tournaments/ipl-2026/contests/${contestId}/leaderboard`)

      const leaderboardRows = page.locator('.leaderboard-table tbody tr')
      await expect(leaderboardRows).toHaveCount(2)
      await expect(leaderboardRows.nth(0)).toContainText(/huntercherryxi/i)
      await expect(leaderboardRows.nth(1)).toContainText(/draker/i)
      const firstPoints = await leaderboardRows.nth(0).locator('td').last().textContent()
      const secondPoints = await leaderboardRows.nth(1).locator('td').last().textContent()
      expect(Number(firstPoints || 0)).toBeGreaterThan(Number(secondPoints || 0))
    } finally {
      await deleteContestIfPresent(request, contestId)
    }
  })
})
