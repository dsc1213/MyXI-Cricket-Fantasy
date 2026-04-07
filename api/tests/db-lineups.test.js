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

describe('match lineup provider contract', () => {
  it('saves announced XI and returns it through team-pool', async () => {
    const tournamentRes = await request(app)
      .post('/admin/tournaments')
      .send({
        actorUserId: 'master',
        tournamentId: 'lineup-contract-tour',
        name: 'Lineup Contract Tour',
        season: '2026',
        source: 'json',
        matches: [
          {
            id: 'm1',
            matchNo: 1,
            home: 'LQ',
            away: 'IU',
            startAt: '2099-03-10T14:00:00.000Z',
            timezone: 'UTC',
            venue: 'Karachi',
          },
        ],
      })
    expect(tournamentRes.status).toBe(201)

    const contestRes = await request(app)
      .post('/admin/contests')
      .send({
        name: 'Lineup Contract Contest',
        tournamentId: 'lineup-contract-tour',
        game: 'Fantasy',
        teams: 20,
        status: 'Open',
        createdBy: 'master',
        matchIds: ['m1'],
      })
    expect(contestRes.status).toBe(201)
    const contestId = contestRes.body.id

    const poolRes = await request(app).get(
      `/team-pool?contestId=${contestId}&matchId=m1&userId=player&actorUserId=player`,
    )
    expect(poolRes.status).toBe(200)
    const teamA = poolRes.body?.teams?.teamA
    const teamB = poolRes.body?.teams?.teamB
    expect(Array.isArray(teamA?.players)).toBe(true)
    expect(Array.isArray(teamB?.players)).toBe(true)

    const lineupRes = await request(app)
      .post('/admin/match-lineups/upsert')
      .send({
        tournamentId: 'lineup-contract-tour',
        contestId,
        matchId: 'm1',
        source: 'manual-xi',
        updatedBy: 'master',
        lineups: {
          [teamA.name]: {
            squad: teamA.players.map((player) => player.name),
            playingXI: teamA.players.slice(0, 11).map((player) => player.name),
            bench: teamA.players.slice(11).map((player) => player.name),
          },
          [teamB.name]: {
            squad: teamB.players.map((player) => player.name),
            playingXI: teamB.players.slice(0, 11).map((player) => player.name),
            bench: teamB.players.slice(11).map((player) => player.name),
          },
        },
      })
    expect(lineupRes.status).toBe(200)
    expect(lineupRes.body.ok).toBe(true)

    const refreshedPool = await request(app).get(
      `/team-pool?contestId=${contestId}&matchId=m1&userId=player&actorUserId=player`,
    )
    expect(refreshedPool.status).toBe(200)
    expect(refreshedPool.body?.teams?.teamA?.lineup?.playingXI?.length).toBe(11)
    expect(refreshedPool.body?.teams?.teamB?.lineup?.playingXI?.length).toBe(11)
  })

  it('accepts lineup name variants for Brijesh Sharma when strictSquad is false', async () => {
    const tournamentRes = await request(app)
      .post('/admin/tournaments')
      .send({
        actorUserId: 'master',
        tournamentId: 'lineup-brijesh-tour',
        name: 'Lineup Brijesh Tour',
        season: '2026',
        source: 'json',
        matches: [
          {
            id: 'm1',
            matchNo: 1,
            home: 'RR',
            away: 'CSK',
            startAt: '2099-03-10T14:00:00.000Z',
            timezone: 'UTC',
            venue: 'Jaipur',
          },
        ],
      })
    expect(tournamentRes.status).toBe(201)

    const contestRes = await request(app)
      .post('/admin/contests')
      .send({
        name: 'Lineup Brijesh Contest',
        tournamentId: 'lineup-brijesh-tour',
        game: 'Fantasy',
        teams: 20,
        status: 'Open',
        createdBy: 'master',
        matchIds: ['m1'],
      })
    expect(contestRes.status).toBe(201)
    const contestId = contestRes.body.id

    const poolRes = await request(app).get(
      `/team-pool?contestId=${contestId}&matchId=m1&userId=player&actorUserId=player`,
    )
    expect(poolRes.status).toBe(200)
    const teamA = poolRes.body?.teams?.teamA
    const teamB = poolRes.body?.teams?.teamB
    expect(Array.isArray(teamA?.players)).toBe(true)
    expect(Array.isArray(teamB?.players)).toBe(true)

    const teamAName = teamA.name
    const teamBName = teamB.name
    const teamASquadNames = teamA.players.map((player) => player.name)
    const teamAPlayingXI = teamA.players.slice(0, 11).map((player) => player.name)
    const teamABench = teamA.players.slice(11).map((player) => player.name)

    const teamAWithBrijesh = {
      squad: [...teamASquadNames, 'Brijesh Sharma'],
      playingXI: [...teamAPlayingXI.slice(0, 10), '  BRIJESH   SHARMA\u200B'],
      bench: teamABench,
    }

    const lineupRes = await request(app)
      .post('/admin/match-lineups/upsert')
      .send({
        tournamentId: 'lineup-brijesh-tour',
        contestId,
        matchId: 'm1',
        source: 'manual-xi',
        updatedBy: 'master',
        dryRun: true,
        strictSquad: false,
        lineups: {
          [teamAName]: teamAWithBrijesh,
          [teamBName]: {
            squad: teamB.players.map((player) => player.name),
            playingXI: teamB.players.slice(0, 11).map((player) => player.name),
            bench: teamB.players.slice(11).map((player) => player.name),
          },
        },
      })

    expect(lineupRes.status).toBe(200)
    expect(lineupRes.body.ok).toBe(true)
    expect(lineupRes.body.saved?.lineups?.[teamAName]?.squad).toEqual(
      expect.arrayContaining(['Brijesh Sharma']),
    )
    expect(lineupRes.body.saved?.lineups?.[teamAName]?.playingXI).toEqual(
      expect.arrayContaining(['BRIJESH SHARMA']),
    )
  })
})
