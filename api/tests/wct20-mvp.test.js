import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'

let app
let resetStore

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
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

describe('WCT20 mock consistency', () => {
  const saveSelection = async ({
    contestId,
    matchId,
    userId,
    includePlayerNames = [],
  }) => {
    const teamPoolRes = await request(app).get(
      `/mock/team-pool?contestId=${contestId}&matchId=${matchId}&userId=${userId}`,
    )
    expect(teamPoolRes.status).toBe(200)
    const allPlayers = [
      ...(teamPoolRes.body?.teams?.teamA?.players || []),
      ...(teamPoolRes.body?.teams?.teamB?.players || []),
    ]
    const includeIds = includePlayerNames
      .map((name) => allPlayers.find((player) => player.name === name)?.id)
      .filter(Boolean)
    const playingXi = Array.from(
      new Set([...includeIds, ...allPlayers.map((player) => player.id)]),
    ).slice(0, 11)
    expect(playingXi.length).toBe(11)
    const saveRes = await request(app).post('/mock/team-selection/save').send({
      contestId,
      matchId,
      userId,
      playingXi,
      backups: [],
    })
    expect(saveRes.status).toBe(200)
  }

  it('keeps participants and leaderboard row counts in sync for a contest', async () => {
    await saveSelection({
      contestId: 'huntercherry',
      matchId: 'm1',
      userId: 'kiran11',
      includePlayerNames: ['Suryakumar Yadav'],
    })

    const participantsRes = await request(app).get(
      '/mock/contests/huntercherry/participants?matchId=m1',
    )
    const leaderboardRes = await request(app).get('/mock/contests/huntercherry/leaderboard')

    expect(participantsRes.status).toBe(200)
    expect(leaderboardRes.status).toBe(200)

    const participants = participantsRes.body.participants || []
    const leaderboardRows = leaderboardRes.body.rows || []

    expect(participants.length).toBeGreaterThan(0)
    expect(leaderboardRows.length).toBeGreaterThan(0)

    const participantUserIds = new Set(participants.map((row) => row.userId))
    const leaderboardUserIds = new Set(leaderboardRows.map((row) => row.userId))
    Array.from(participantUserIds).forEach((userId) => {
      expect(leaderboardUserIds.has(userId)).toBe(true)
    })
  })

  it('shows non-zero leaderboard totals for completed contests even before manual score upload', async () => {
    const matchesRes = await request(app).get('/mock/contests/ipl-last-over/matches?userId=kiran11')
    expect(matchesRes.status).toBe(200)
    const firstMatchId = (matchesRes.body || [])[0]?.id
    expect(firstMatchId).toBeTruthy()
    await saveSelection({
      contestId: 'ipl-last-over',
      matchId: firstMatchId,
      userId: 'kiran11',
      includePlayerNames: ['Virat Kohli'],
    })

    const leaderboardRes = await request(app).get('/mock/contests/ipl-last-over/leaderboard')
    expect(leaderboardRes.status).toBe(200)
    const rows = leaderboardRes.body.rows || []
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => Number(row.points || 0) >= 0)).toBe(true)
  })

  it('keeps no-team participant points in sync with empty eye preview', async () => {
    const matchesRes = await request(app).get(
      '/mock/contests/huntercherry/matches?userId=master',
    )
    expect(matchesRes.status).toBe(200)
    const noTeamMatch = (matchesRes.body || []).find((row) => !row.hasTeam)
    expect(noTeamMatch).toBeTruthy()

    const participantsRes = await request(app).get(
      `/mock/contests/huntercherry/participants?matchId=${noTeamMatch.id}&userId=master`,
    )
    expect(participantsRes.status).toBe(200)
    const masterRow = (participantsRes.body.participants || []).find(
      (row) => row.userId === 'master',
    )
    expect(masterRow).toBeFalsy()

    const picksRes = await request(app).get(
      `/mock/users/master/picks?tournamentId=t20wc-2026&contestId=huntercherry&matchId=${noTeamMatch.id}`,
    )
    expect(picksRes.status).toBe(200)
    expect(Array.isArray(picksRes.body.picksDetailed)).toBe(true)
    expect(picksRes.body.picksDetailed.length).toBe(0)
  })

  it('keeps participant totals, eye preview totals, and stats totals in sync for multiple matches', async () => {
    const contestId = 'huntercherry'
    const tournamentId = 't20wc-2026'
    const userId = 'master'

    const matchesRes = await request(app).get(
      `/mock/contests/${contestId}/matches?team=IND&status=all&userId=${userId}`,
    )
    expect(matchesRes.status).toBe(200)
    const selectedMatches = (matchesRes.body || []).slice(0, 3)
    expect(selectedMatches.length).toBe(3)

    const [m1, m2, m3] = selectedMatches

    const saveXi = async (matchId, extraNames = []) => {
      const teamPoolRes = await request(app).get(
        `/mock/team-pool?contestId=${contestId}&matchId=${matchId}&userId=${userId}`,
      )
      expect(teamPoolRes.status).toBe(200)
      const allPlayers = [
        ...(teamPoolRes.body?.teams?.teamA?.players || []),
        ...(teamPoolRes.body?.teams?.teamB?.players || []),
      ]
      const mustIncludeIds = extraNames
        .map((name) => allPlayers.find((player) => player.name === name)?.id)
        .filter(Boolean)
      const xiIds = Array.from(new Set([...mustIncludeIds, ...allPlayers.map((player) => player.id)])).slice(
        0,
        11,
      )
      expect(xiIds.length).toBe(11)
      const saveRes = await request(app).post('/mock/team-selection/save').send({
        contestId,
        matchId,
        userId,
        playingXi: xiIds,
        backups: [],
      })
      expect(saveRes.status).toBe(200)
    }

    await saveXi(m1.id, ['Suryakumar Yadav'])
    await saveXi(m2.id, ['Suryakumar Yadav'])
    await saveXi(m3.id, ['Suryakumar Yadav'])

    const applyScore = async (matchId, playerStats) => {
      const scoreRes = await request(app).post('/mock/admin/match-scores/upsert').send({
        tournamentId,
        contestId,
        matchId,
        userId: 'admin',
        playerStats,
      })
      expect(scoreRes.status).toBe(200)
    }

    await applyScore(m1.id, [
      {
        playerName: 'Suryakumar Yadav',
        runs: 20,
        fours: 2,
        sixes: 1,
        wickets: 0,
        catches: 0,
      },
      {
        playerName: 'Hardik Pandya',
        runs: 70,
        fours: 4,
        sixes: 3,
        wickets: 1,
        catches: 0,
      },
    ])
    await applyScore(m2.id, [
      {
        playerName: 'Suryakumar Yadav',
        runs: 40,
        fours: 3,
        sixes: 2,
        wickets: 0,
        catches: 0,
      },
      {
        playerName: 'Hardik Pandya',
        runs: 30,
        fours: 2,
        sixes: 1,
        wickets: 0,
        catches: 1,
      },
    ])

    const verifyMatchConsistency = async (matchId) => {
      const participantsRes = await request(app).get(
        `/mock/contests/${contestId}/participants?matchId=${matchId}&userId=${userId}`,
      )
      expect(participantsRes.status).toBe(200)
      const masterParticipant = (participantsRes.body?.participants || []).find(
        (row) => row.userId === userId,
      )
      expect(masterParticipant).toBeTruthy()

      const picksRes = await request(app).get(
        `/mock/users/${userId}/picks?tournamentId=${tournamentId}&contestId=${contestId}&matchId=${matchId}`,
      )
      expect(picksRes.status).toBe(200)
      const eyeTotal = (picksRes.body?.picksDetailed || []).reduce(
        (sum, row) => sum + Number(row.points || 0),
        0,
      )
      expect(Number(masterParticipant.points || 0)).toBe(eyeTotal)
      return eyeTotal
    }

    const m1Total = await verifyMatchConsistency(m1.id)
    const m2Total = await verifyMatchConsistency(m2.id)
    const m3Total = await verifyMatchConsistency(m3.id)
    expect(m1Total).toBeGreaterThan(0)
    expect(m2Total).toBeGreaterThan(0)
    expect(m3Total).toBeGreaterThan(0)

    const statsRes = await request(app).get(`/mock/player-stats?tournamentId=${tournamentId}`)
    expect(statsRes.status).toBe(200)
    const skyRow = (statsRes.body || []).find((row) => row.name === 'Suryakumar Yadav')
    expect(skyRow).toBeTruthy()
    const expectedSkyPointsFromMatches = 20 + 2 + 2 + 40 + 3 + 4 + 3
    expect(Number(skyRow.points || 0)).toBe(expectedSkyPointsFromMatches)

    const leaderboardRes = await request(app).get(`/mock/contests/${contestId}/leaderboard`)
    expect(leaderboardRes.status).toBe(200)
    const leaderboardRows = leaderboardRes.body?.rows || []
    const participantsForM1Res = await request(app).get(
      `/mock/contests/${contestId}/participants?matchId=${m1.id}&userId=${userId}`,
    )
    expect(participantsForM1Res.status).toBe(200)
    const participantRows = participantsForM1Res.body?.participants || []
    const sharedUser = participantRows.find((row) =>
      leaderboardRows.some((leaderboardRow) => leaderboardRow.userId === row.userId),
    )
    expect(sharedUser).toBeTruthy()
    const leaderboardSharedUser = leaderboardRows.find(
      (row) => row.userId === sharedUser.userId,
    )
    expect(leaderboardSharedUser).toBeTruthy()

    const matchScoresRes = await request(app).get(
      `/mock/contests/${contestId}/users/${sharedUser.userId}/match-scores`,
    )
    expect(matchScoresRes.status).toBe(200)
    const matchScoreTotal = (matchScoresRes.body?.rows || []).reduce(
      (sum, row) => sum + Number(row.userPoints || 0),
      0,
    )
    expect(Number(leaderboardSharedUser.points || 0)).toBe(matchScoreTotal)
  }, 90000)

  it('returns match-specific country squads for team pool', async () => {
    const m1Res = await request(app).get(
      '/mock/team-pool?contestId=huntercherry&matchId=m1&userId=rahul-xi',
    )
    expect(m1Res.status).toBe(200)
    expect(m1Res.body.activeMatch.home).toBe('IND')
    expect(m1Res.body.activeMatch.away).toBe('USA')
    expect(m1Res.body.teams.teamA.players.some((player) => player.name === 'Suryakumar Yadav')).toBe(
      true,
    )
    expect(m1Res.body.teams.teamB.players.some((player) => player.name === 'Monank Patel')).toBe(true)

    const m7Res = await request(app).get(
      '/mock/team-pool?contestId=huntercherry&matchId=m11&userId=rahul-xi',
    )
    expect(m7Res.status).toBe(200)
    expect(m7Res.body.activeMatch.home).toBe('AUS')
    expect(m7Res.body.activeMatch.away).toBe('SL')
    expect(m7Res.body.teams.teamA.players.some((player) => player.name === 'Mitchell Marsh')).toBe(
      true,
    )
    expect(m7Res.body.teams.teamB.players.some((player) => player.name === 'Dasun Shanaka')).toBe(true)
  })

  it('propagates match score upsert into per-user match totals', async () => {
    const targetUserId = 'kiran11'
    await saveSelection({
      contestId: 'huntercherry',
      matchId: 'm1',
      userId: targetUserId,
      includePlayerNames: ['Suryakumar Yadav', 'Monank Patel', 'Pat Cummins'],
    })

    const beforeRes = await request(app).get(
      `/mock/contests/huntercherry/users/${targetUserId}/match-scores`,
    )
    expect(beforeRes.status).toBe(200)
    const beforeM1 = (beforeRes.body.rows || []).find((row) => row.matchId === 'm1')
    expect(beforeM1).toBeTruthy()

    const upsertRes = await request(app)
      .post('/mock/admin/match-scores/upsert')
      .send({
        tournamentId: 't20wc-2026',
        contestId: 'huntercherry',
        matchId: 'm1',
        userId: 'admin',
        playerStats: [
          {
            playerName: 'Suryakumar Yadav',
            runs: 66,
            fours: 6,
            sixes: 3,
            wickets: 0,
            catches: 1,
          },
          {
            playerName: 'Monank Patel',
            runs: 52,
            fours: 4,
            sixes: 2,
            wickets: 0,
            catches: 0,
          },
          {
            playerName: 'Pat Cummins',
            runs: 8,
            fours: 1,
            sixes: 0,
            wickets: 2,
            catches: 1,
          },
        ],
      })
    expect(upsertRes.status).toBe(200)

    const afterRes = await request(app).get(
      `/mock/contests/huntercherry/users/${targetUserId}/match-scores`,
    )
    expect(afterRes.status).toBe(200)
    const afterM1 = (afterRes.body.rows || []).find((row) => row.matchId === 'm1')
    expect(afterM1).toBeTruthy()
    expect(Number(afterM1.userPoints || 0)).not.toBe(Number(beforeM1.userPoints || 0))
  }, 20000)

  it('publishes wide WCT20 player stats pool across squads', async () => {
    const res = await request(app).get('/mock/player-stats?tournamentId=t20wc-2026')
    expect(res.status).toBe(200)
    const rows = res.body || []
    expect(rows.length).toBeGreaterThanOrEqual(280)

    const teamCodes = new Set(rows.map((row) => row.team))
    ;['AFG', 'AUS', 'CAN', 'ENG', 'IND', 'ITA', 'PAK', 'SA', 'USA', 'ZIM'].forEach((code) => {
      expect(teamCodes.has(code)).toBe(true)
    })
  })

  it('accepts valid manual lineup upsert payload', async () => {
    const validPayload = {
      tournamentId: 't20wc-2026',
      contestId: 'huntercherry',
      matchId: 'm1',
      source: 'manual-xi',
      updatedBy: 'admin',
      lineups: {
        IND: {
          squad: [
            'Suryakumar Yadav',
            'Abhishek Sharma',
            'Tilak Varma',
            'Sanju Samson',
            'Shivam Dube',
            'Ishan Kishan',
            'Hardik Pandya',
            'Arshdeep Singh',
            'Jasprit Bumrah',
            'Harshit Rana',
            'Varun Chakaravarthy',
            'Kuldeep Yadav',
            'Axar Patel',
            'Washington Sundar',
            'Rinku Singh',
          ],
          playingXI: [
            'Suryakumar Yadav',
            'Abhishek Sharma',
            'Tilak Varma',
            'Sanju Samson',
            'Shivam Dube',
            'Hardik Pandya',
            'Arshdeep Singh',
            'Jasprit Bumrah',
            'Harshit Rana',
            'Varun Chakaravarthy',
            'Axar Patel',
          ],
          captain: 'Suryakumar Yadav',
          viceCaptain: 'Hardik Pandya',
        },
        USA: {
          squad: [
            'Monank Patel',
            'Ehsan Adil',
            'Andries Gous',
            'Shehan Jayasuriya',
            'Milind Kumar',
            'Shayan Jahangir',
            'Saiteja Mukkamala',
            'Sanjay Krishnamurthi',
            'Harmeet Singh',
            'Nosthush Kenjige',
            'Shadley Van Schalkwyk',
            'Saurabh Netravalkar',
            'Ali Khan',
            'Mohammad Mohsin',
            'Shubham Ranjane',
          ],
          playingXI: [
            'Monank Patel',
            'Andries Gous',
            'Milind Kumar',
            'Shayan Jahangir',
            'Saiteja Mukkamala',
            'Sanjay Krishnamurthi',
            'Harmeet Singh',
            'Nosthush Kenjige',
            'Saurabh Netravalkar',
            'Ali Khan',
            'Shubham Ranjane',
          ],
          captain: 'Monank Patel',
          viceCaptain: 'Saurabh Netravalkar',
        },
      },
    }

    const upsertRes = await request(app).post('/mock/admin/match-lineups/upsert').send(validPayload)
    expect(upsertRes.status).toBe(200)
    expect(upsertRes.body.ok).toBe(true)

    const fetchRes = await request(app).get(
      '/mock/admin/match-lineups/t20wc-2026/m1?contestId=huntercherry',
    )
    expect(fetchRes.status).toBe(200)
    expect(fetchRes.body.saved).toBeTruthy()
    expect(fetchRes.body.saved.lineups.IND.playingXI.length).toBe(11)
    expect(fetchRes.body.saved.lineups.USA.playingXI.length).toBe(11)
  })

  it('rejects invalid lineup payload when XI contains non-squad player', async () => {
    const invalidPayload = {
      tournamentId: 't20wc-2026',
      contestId: 'huntercherry',
      matchId: 'm1',
      source: 'manual-xi',
      updatedBy: 'admin',
      lineups: {
        IND: {
          squad: [
            'Suryakumar Yadav',
            'Abhishek Sharma',
            'Tilak Varma',
            'Sanju Samson',
            'Shivam Dube',
            'Ishan Kishan',
            'Hardik Pandya',
            'Arshdeep Singh',
            'Jasprit Bumrah',
            'Harshit Rana',
            'Varun Chakaravarthy',
            'Kuldeep Yadav',
            'Axar Patel',
            'Washington Sundar',
            'Rinku Singh',
          ],
          playingXI: [
            'Suryakumar Yadav',
            'Abhishek Sharma',
            'Tilak Varma',
            'Sanju Samson',
            'Shivam Dube',
            'Hardik Pandya',
            'Arshdeep Singh',
            'Jasprit Bumrah',
            'Harshit Rana',
            'Varun Chakaravarthy',
            'Rohit Sharma',
          ],
          captain: 'Suryakumar Yadav',
          viceCaptain: 'Hardik Pandya',
        },
        USA: {
          squad: [
            'Monank Patel',
            'Ehsan Adil',
            'Andries Gous',
            'Shehan Jayasuriya',
            'Milind Kumar',
            'Shayan Jahangir',
            'Saiteja Mukkamala',
            'Sanjay Krishnamurthi',
            'Harmeet Singh',
            'Nosthush Kenjige',
            'Shadley Van Schalkwyk',
            'Saurabh Netravalkar',
            'Ali Khan',
            'Mohammad Mohsin',
            'Shubham Ranjane',
          ],
          playingXI: [
            'Monank Patel',
            'Andries Gous',
            'Milind Kumar',
            'Shayan Jahangir',
            'Saiteja Mukkamala',
            'Sanjay Krishnamurthi',
            'Harmeet Singh',
            'Nosthush Kenjige',
            'Saurabh Netravalkar',
            'Ali Khan',
            'Shubham Ranjane',
          ],
        },
      },
    }

    const res = await request(app).post('/mock/admin/match-lineups/upsert').send(invalidPayload)
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('is not in squad')
  })
})
