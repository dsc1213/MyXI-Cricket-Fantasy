import { expect, test } from '@playwright/test'
import { apiCall } from './helpers/mock-e2e.js'

const MASTER_LOGIN =
  process.env.PW_E2E_MASTER_LOGIN || process.env.PW_DB_MASTER_LOGIN || 'master'
const MASTER_PASSWORD =
  process.env.PW_E2E_MASTER_PASSWORD || process.env.PW_DB_MASTER_PASSWORD || 'demo123'
const E2E_API_BASE = process.env.PW_E2E_API_BASE_URL || 'http://127.0.0.1:4000'

const buildSquad = (prefix, tag) =>
  Array.from({ length: 11 }).map((_, index) => {
    const role = index === 0 ? 'WK' : index < 6 ? 'BAT' : index < 8 ? 'AR' : 'BOWL'
    return {
      id: `${prefix.toLowerCase()}-${tag}-${index + 1}`,
      name: `${prefix} XI ${index + 1}`,
      country: 'india',
      role,
    }
  })

test('lineup upsert auto-heals squad when strictSquad is false', async ({ request }) => {
  const tag = Date.now()
  const tournamentSourceKey = `lineup-heal-${tag}`
  const tournamentName = `Lineup Heal ${tag}`
  let createdTournamentId = ''

  try {
    const auth = await apiCall(
      request,
      'POST',
      '/auth/login',
      { userId: MASTER_LOGIN, password: MASTER_PASSWORD },
      200,
    )
    const actorUserId =
      auth?.user?.userId || auth?.user?.gameName || auth?.user?.email || MASTER_LOGIN

    const tournamentCreate = await apiCall(
      request,
      'POST',
      '/admin/tournaments',
      {
        actorUserId,
        tournamentId: tournamentSourceKey,
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
            venue: 'Mumbai',
          },
        ],
      },
      201,
    )

    createdTournamentId = String(tournamentCreate?.tournament?.id || '')
    expect(createdTournamentId).not.toBe('')

    const teamASquad = buildSquad('Alpha', tag)
    const teamBSquad = buildSquad('Bravo', tag)

    await apiCall(
      request,
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
      request,
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

    const missingFromSquad = 'Alpha XI 11'
    const lineups = {
      AAA: {
        squad: teamASquad
          .map((row) => row.name)
          .filter((name) => name !== missingFromSquad),
        playingXI: teamASquad.map((row) => row.name),
        bench: [],
      },
      BBB: {
        squad: teamBSquad.map((row) => row.name),
        playingXI: teamBSquad.map((row) => row.name),
        bench: [],
      },
    }

    const response = await apiCall(
      request,
      'POST',
      '/admin/match-lineups/upsert',
      {
        tournamentId: createdTournamentId,
        matchId: 'm1',
        updatedBy: actorUserId,
        source: 'json-lineup',
        dryRun: true,
        strictSquad: false,
        lineups,
      },
      200,
    )

    expect(response?.ok).toBe(true)
    expect(response?.dryRun).toBe(true)
    expect(response?.saved?.lineups?.AAA?.playingXI).toContain(missingFromSquad)
    expect(response?.saved?.lineups?.AAA?.squad).toContain(missingFromSquad)
  } finally {
    if (createdTournamentId) {
      try {
        await request.fetch(`${E2E_API_BASE}/admin/tournaments/${createdTournamentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          data: { actorUserId: MASTER_LOGIN },
        })
      } catch {
        // best effort cleanup
      }
    }
  }
})
