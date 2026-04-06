import { expect, test } from '@playwright/test'
import { apiCall, deleteContestIfPresent, loginUi } from './helpers/mock-e2e.js'

const E2E_API_BASE = process.env.PW_E2E_API_BASE_URL || 'http://127.0.0.1:4000'

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
          home: 'RCB',
          away: 'SRH',
          date: '2099-04-10',
          startAt: '2099-04-10T14:00:00.000Z',
          venue: 'Bengaluru',
        },
      ],
    },
    201,
  )

test('fantasy contest card shows compact tournament + contest header and hides teams row', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)

  const tag = Date.now()
  const tournamentName = `IPL 2026 ${tag}`
  const contestName = `TEST IPL ${tag}`
  const tournamentId = `fantasy-head-compact-tour-${tag}`
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
        teams: 10,
        maxParticipants: 10,
        status: 'In Progress',
        joined: false,
        createdBy: 'master',
        startAt: '2000-01-01T09:00:00.000Z',
        matchIds: ['m1'],
      },
      201,
    )
    contestId = contest.id

    await page.setViewportSize({ width: 1366, height: 768 })
    await loginUi(page, 'master')
    await page.goto('/fantasy', { waitUntil: 'domcontentloaded' })

    const tournamentTile = page
      .locator('.tournament-filter-tile')
      .filter({ hasText: tournamentName })
      .first()
    await expect(tournamentTile).toBeVisible()
    await tournamentTile.click()

    const card = page
      .locator('.compact-contest-card')
      .filter({ hasText: contestName })
      .first()
    await expect(card).toBeVisible()

    await expect(
      card.locator('.contest-title-combo .contest-tournament-pill'),
    ).toHaveText(tournamentName)
    await expect(card.locator('.contest-title-combo strong')).toHaveText(contestName)
    const contestColorVar = await card.evaluate((node) =>
      node.style.getPropertyValue('--contest-tournament-color').trim(),
    )
    expect(contestColorVar.length).toBeGreaterThan(0)
    await expect(
      card.locator('.team-note').filter({ hasText: /\bteams\b/i }),
    ).toHaveCount(0)
    await expect(card.locator('.team-note').filter({ hasText: /^Starts:/i })).toHaveCount(
      0,
    )
  } finally {
    await deleteContestIfPresent(request, contestId, 'master')
    await request.fetch(`${E2E_API_BASE}/admin/tournaments/${tournamentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      data: { actorUserId: 'master' },
    })
  }
})
