import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

let app
let resetStore

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.MOCK_API = 'true'
  process.env.DB_PROVIDER = 'mock'
  process.env.MASTER_ADMIN_EMAIL = 'master@myxi.local'
  process.env.MASTER_ADMIN_PASSWORD = 'demo123'
  process.env.MASTER_ADMIN_NAME = 'Master Admin'
  process.env.JWT_SECRET = 'test-secret'
  process.env.JWT_EXPIRES_IN = '1h'

  const mod = await import('../src/server.js')
  app = mod.app
  resetStore = mod.resetStore
})

beforeEach(() => {
  resetStore()
})

describe('score upload scenarios', () => {
  const tournamentId = 't20wc-2026'
  const matchId = 'm1'

  const getKnownPlayersForMatch = async () => {
    const poolRes = await request(app).get(
      `/team-pool?tournamentId=${tournamentId}&matchId=${matchId}&userId=master&actorUserId=master`,
    )
    expect(poolRes.status).toBe(200)

    const teamAPlayers = poolRes.body?.teams?.teamA?.players || []
    const teamBPlayers = poolRes.body?.teams?.teamB?.players || []
    const firstA = teamAPlayers[0]?.name
    const firstB = teamBPlayers[0]?.name

    expect(firstA).toBeTruthy()
    expect(firstB).toBeTruthy()

    return { firstA, firstB }
  }

  it('JSON upload with valid data saves score and returns expected payload', async () => {
    const { firstA, firstB } = await getKnownPlayersForMatch()

    const payloadText = JSON.stringify(
      {
        playerStats: [
          {
            playerName: firstA,
            runs: 31,
            ballsFaced: 22,
            fours: 4,
            sixes: 1,
            dismissed: true,
          },
          {
            playerName: firstB,
            runs: 14,
            ballsFaced: 10,
            fours: 2,
            sixes: 0,
            dismissed: false,
          },
        ],
      },
      null,
      2,
    )

    const saveRes = await request(app).post('/match-scores/save').send({
      payloadText,
      tournamentId,
      matchId,
      source: 'json',
      userId: 'master',
    })

    expect(saveRes.status).toBe(200)
    expect(saveRes.body?.ok).toBe(true)
    expect(saveRes.body?.savedScore?.matchId).toBe(matchId)
    expect(saveRes.body?.savedScore?.tournamentId).toBe(tournamentId)
    expect(Array.isArray(saveRes.body?.savedScore?.playerStats)).toBe(true)
    expect(saveRes.body?.savedScore?.playerStats?.length).toBeGreaterThan(0)
    expect(Number(saveRes.body?.impactedContests || 0)).toBeGreaterThanOrEqual(0)
  })

  it('JSON upload with wrong player data returns unmatched details', async () => {
    const payloadText = JSON.stringify(
      {
        playerStats: [
          {
            playerName: 'Unknown Test Player Name',
            runs: 10,
            ballsFaced: 8,
            dismissed: true,
          },
        ],
      },
      null,
      2,
    )

    const saveRes = await request(app).post('/match-scores/save').send({
      payloadText,
      tournamentId,
      matchId,
      source: 'json',
      userId: 'master',
      dryRun: true,
    })

    expect(saveRes.status).toBe(400)
    expect(saveRes.body?.message || '').toContain('not in selected match teams')
    expect(Array.isArray(saveRes.body?.unmatchedPlayers)).toBe(true)
    expect(saveRes.body?.unmatchedPlayers || []).toContain('Unknown Test Player Name')
    expect(Array.isArray(saveRes.body?.unmatchedDetails)).toBe(true)
    expect(saveRes.body?.unmatchedDetails?.[0]?.input).toBe('Unknown Test Player Name')
    expect(Array.isArray(saveRes.body?.unmatchedDetails?.[0]?.suggestions)).toBe(true)
  })

  it('JSON upload with invalid payloadText returns parser error', async () => {
    const saveRes = await request(app).post('/match-scores/save').send({
      payloadText: '{"playerStats": [}',
      tournamentId,
      matchId,
      source: 'json',
      userId: 'master',
    })

    expect(saveRes.status).toBe(400)
    expect(saveRes.body?.message).toBe('Invalid JSON payloadText')
  })

  it('manual score update saves data and returns expected response shape', async () => {
    const { firstA } = await getKnownPlayersForMatch()

    const saveRes = await request(app)
      .post('/admin/match-scores/upsert')
      .send({
        tournamentId,
        matchId,
        contestId: 'huntercherry',
        userId: 'master',
        teamScore: {},
        playerStats: [
          {
            playerName: firstA,
            runs: 26,
            ballsFaced: 19,
            fours: 3,
            sixes: 1,
            wickets: 0,
            catches: 0,
            dismissed: true,
          },
        ],
      })

    expect(saveRes.status).toBe(200)
    expect(saveRes.body?.ok).toBe(true)
    expect(saveRes.body?.savedScore?.matchId).toBe(matchId)
    expect(saveRes.body?.savedScore?.tournamentId).toBe(tournamentId)
    expect(Array.isArray(saveRes.body?.savedScore?.playerStats)).toBe(true)
    expect(saveRes.body?.savedScore?.playerStats?.length).toBeGreaterThan(0)
    expect(Array.isArray(saveRes.body?.topPlayers)).toBe(true)
  })
})
