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

describe('mock admin lifecycle', () => {
  it('enables and disables tournament catalog entries', async () => {
    const before = await request(app).get('/mock/tournaments')
    expect(before.status).toBe(200)
    expect(before.body.some((t) => t.id === 'hundred-2026')).toBe(false)

    const add = await request(app).post('/mock/admin/tournaments/enable').send({
      ids: ['hundred-2026'],
      actorUserId: 'master',
    })
    expect(add.status).toBe(200)
    expect(add.body.ok).toBe(true)
    expect(add.body.tournaments.some((t) => t.id === 'hundred-2026')).toBe(true)

    const afterEnable = await request(app).get('/mock/tournaments')
    expect(afterEnable.status).toBe(200)
    expect(afterEnable.body.some((t) => t.id === 'hundred-2026')).toBe(true)

    const remove = await request(app).post('/mock/admin/tournaments/disable').send({
      ids: ['hundred-2026'],
      actorUserId: 'master',
    })
    expect(remove.status).toBe(200)
    expect(remove.body.ok).toBe(true)
    expect(remove.body.tournaments.some((t) => t.id === 'hundred-2026')).toBe(false)

    const afterDisable = await request(app).get('/mock/tournaments')
    expect(afterDisable.status).toBe(200)
    expect(afterDisable.body.some((t) => t.id === 'hundred-2026')).toBe(false)
  })

  it('creates and deletes a custom contest in enabled tournament', async () => {
    const uniqueName = `E2E Flow Contest ${Date.now()}`
    const matchOptionsRes = await request(app).get(
      '/mock/admin/contest-match-options?tournamentId=t20wc-2026',
    )
    expect(matchOptionsRes.status).toBe(200)
    const matchIds = (matchOptionsRes.body || [])
      .filter((row) => String(row.status).toLowerCase() === 'notstarted')
      .slice(0, 3)
      .map((row) => row.id)
    expect(matchIds.length).toBeGreaterThan(0)

    const createRes = await request(app).post('/mock/admin/contests').send({
      name: uniqueName,
      tournamentId: 't20wc-2026',
      game: 'Fantasy',
      teams: 77,
      status: 'Open',
      joined: false,
      createdBy: 'master',
      matchIds,
    })
    expect([200, 201]).toContain(createRes.status)
    expect(createRes.body.id).toBeTruthy()
    const contestId = createRes.body.id

    const listRes = await request(app).get(
      '/mock/contests?tournamentId=t20wc-2026&userId=master&joined=false',
    )
    expect(listRes.status).toBe(200)
    const beforeDeleteCount = (listRes.body || []).length
    expect(listRes.body.some((contest) => contest.id === contestId)).toBe(true)

    const deleteRes = await request(app)
      .delete(`/mock/admin/contests/${contestId}`)
      .send({ actorUserId: '1' })
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.ok).toBe(true)
    expect(deleteRes.body.removedId).toBe(contestId)

    const afterDelete = await request(app).get(
      '/mock/contests?tournamentId=t20wc-2026&userId=master&joined=false',
    )
    expect(afterDelete.status).toBe(200)
    expect(afterDelete.body.some((contest) => contest.id === contestId)).toBe(false)
    expect((afterDelete.body || []).length).toBe(Math.max(0, beforeDeleteCount - 1))
  })

  it('creates and deletes a tournament with custom matches', async () => {
    const tournamentId = `bot-cup-${Date.now()}`
    const createTournament = await request(app).post('/mock/admin/tournaments').send({
      actorUserId: 'master',
      tournamentId,
      name: 'Bot Cup',
      season: '2026',
      source: 'manual',
      matches: [
        {
          matchNo: 1,
          id: 'm1',
          home: 'IND',
          away: 'AUS',
          date: '2099-01-01',
          startAt: '2099-01-01T14:00:00.000Z',
          venue: 'Test Ground',
        },
        {
          matchNo: 2,
          id: 'm2',
          home: 'ENG',
          away: 'NZ',
          date: '2099-01-02',
          startAt: '2099-01-02T14:00:00.000Z',
          venue: 'Test Ground 2',
        },
      ],
    })
    expect(createTournament.status).toBe(201)
    expect(createTournament.body.ok).toBe(true)
    expect(createTournament.body.tournament.id).toBe(tournamentId)

    const contestsBefore = await request(app)
      .get('/mock/contests')
      .query({ tournamentId, game: 'Fantasy', userId: 'master' })
    expect(contestsBefore.status).toBe(200)
    expect(Array.isArray(contestsBefore.body)).toBe(true)
    expect(contestsBefore.body.length).toBe(0)

    const createContest = await request(app).post('/mock/admin/contests').send({
      name: 'Bot Cup Contest',
      tournamentId,
      game: 'Fantasy',
      teams: 11,
      status: 'Open',
      joined: false,
      createdBy: 'master',
      matchIds: ['m1', 'm2'],
    })
    expect(createContest.status).toBe(201)

    const deleteTournament = await request(app)
      .delete(`/mock/admin/tournaments/${tournamentId}`)
      .send({ actorUserId: 'master' })
    expect(deleteTournament.status).toBe(200)
    expect(deleteTournament.body.ok).toBe(true)
    expect(Number(deleteTournament.body.removedContests || 0)).toBeGreaterThanOrEqual(1)

    const catalogAfterDelete = await request(app).get('/mock/admin/tournaments/catalog')
    expect(catalogAfterDelete.status).toBe(200)
    expect(catalogAfterDelete.body.some((row) => row.id === tournamentId)).toBe(false)
  })

  it('creates, updates and deletes team squads', async () => {
    const listBefore = await request(app).get('/mock/admin/team-squads')
    expect(listBefore.status).toBe(200)
    const beforeCount = (listBefore.body || []).length

    const createRes = await request(app).post('/mock/admin/team-squads').send({
      actorUserId: 'master',
      teamCode: 'CSK',
      teamName: 'Chennai Super Kings',
      source: 'manual',
      squad: [
        'Ruturaj Gaikwad',
        'Devon Conway',
        'MS Dhoni',
        'Ravindra Jadeja',
        'Shivam Dube',
        'Rachin Ravindra',
        'Matheesha Pathirana',
        'Maheesh Theekshana',
        'Deepak Chahar',
        'Tushar Deshpande',
        'Moeen Ali',
      ],
    })
    expect([200, 201]).toContain(createRes.status)
    expect(createRes.body.ok).toBe(true)
    expect(createRes.body.squad.teamCode).toBe('CSK')

    const updateRes = await request(app).post('/mock/admin/team-squads').send({
      actorUserId: 'master',
      teamCode: 'CSK',
      teamName: 'CSK',
      source: 'json',
      squad: [
        'Ruturaj Gaikwad',
        'Devon Conway',
        'MS Dhoni',
        'Ravindra Jadeja',
        'Shivam Dube',
        'Rachin Ravindra',
        'Matheesha Pathirana',
        'Maheesh Theekshana',
        'Deepak Chahar',
        'Tushar Deshpande',
        'Moeen Ali',
        'Ajinkya Rahane',
      ],
    })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.squad.playersCount).toBe(12)

    const listAfter = await request(app).get('/mock/admin/team-squads?teamCode=CSK')
    expect(listAfter.status).toBe(200)
    expect((listAfter.body || []).length).toBe(1)
    expect(listAfter.body[0].teamCode).toBe('CSK')
    expect(Number(listAfter.body[0].playersCount)).toBe(12)

    const deleteRes = await request(app)
      .delete('/mock/admin/team-squads/CSK')
      .send({ actorUserId: 'master' })
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.body.ok).toBe(true)

    const listFinal = await request(app).get('/mock/admin/team-squads')
    expect(listFinal.status).toBe(200)
    expect((listFinal.body || []).some((row) => row.teamCode === 'CSK')).toBe(false)
    expect((listFinal.body || []).length).toBeLessThanOrEqual(beforeCount)
  })

  it('syncs contests from admin manager tab by tournament', async () => {
    const catalogRes = await request(app).get('/mock/admin/contests/catalog?tournamentId=t20wc-2026')
    expect(catalogRes.status).toBe(200)
    const catalogRows = catalogRes.body || []
    expect(catalogRows.length).toBeGreaterThan(0)

    const keepId = catalogRows[0].id
    const syncRes = await request(app).post('/mock/admin/contests/sync').send({
      tournamentId: 't20wc-2026',
      enabledIds: [keepId],
    })
    expect(syncRes.status).toBe(200)
    expect(syncRes.body.ok).toBe(true)
    expect(syncRes.body.enabledIds).toEqual([keepId])

    const listRes = await request(app).get('/mock/admin/contests/catalog?tournamentId=t20wc-2026')
    expect(listRes.status).toBe(200)
    const enabledIds = (listRes.body || [])
      .filter((row) => row.enabled)
      .map((row) => row.id)
    expect(enabledIds).toEqual([keepId])
  })

  it('does not auto-seed teams for users joining custom contests', async () => {
    const matchOptionsRes = await request(app).get(
      '/mock/admin/contest-match-options?tournamentId=t20wc-2026',
    )
    expect(matchOptionsRes.status).toBe(200)
    const scopedMatchIds = (matchOptionsRes.body || [])
      .filter((row) => String(row.status).toLowerCase() === 'notstarted')
      .slice(0, 2)
      .map((row) => row.id)
    expect(scopedMatchIds.length).toBe(2)

    const createRes = await request(app).post('/mock/admin/contests').send({
      name: 'No Auto Team Contest',
      tournamentId: 't20wc-2026',
      game: 'Fantasy',
      teams: 20,
      status: 'Open',
      joined: false,
      createdBy: 'master',
      matchIds: scopedMatchIds,
    })
    expect(createRes.status).toBe(201)
    const contestId = createRes.body.id

    const joinRes = await request(app)
      .post(`/mock/contests/${contestId}/join`)
      .send({ userId: 'kiran11' })
    expect(joinRes.status).toBe(200)
    expect(joinRes.body.joined).toBe(true)

    const matchesRes = await request(app).get(
      `/mock/contests/${contestId}/matches?userId=kiran11`,
    )
    expect(matchesRes.status).toBe(200)
    const rows = matchesRes.body || []
    expect(rows.length).toBe(2)
    expect(rows.every((row) => !row.hasTeam)).toBe(true)
    expect(rows.every((row) => Number.isFinite(Number(row.submittedCount)))).toBe(true)
    expect(rows.every((row) => Number(row.submittedCount || 0) === 1)).toBe(true)
  })

  it('backfills completed contest teams for joined seeded users', async () => {
    const contestsRes = await request(app)
      .get('/mock/contests')
      .query({ game: 'Fantasy', userId: 'sreecharan' })
    expect(contestsRes.status).toBe(200)
    const contests = contestsRes.body || []
    expect(contests.length).toBeGreaterThan(0)

    let checked = null
    for (const contest of contests) {
      const res = await request(app)
        .get(`/mock/contests/${contest.id}/matches`)
        .query({ userId: 'sreecharan' })
      if (res.status !== 200) continue
      const completed = (res.body || []).filter(
        (row) => String(row.status).toLowerCase() === 'completed',
      )
      if (!completed.length) continue
      checked = completed
      break
    }

    expect(Array.isArray(checked)).toBe(true)
    expect((checked || []).length).toBeGreaterThan(0)
    expect((checked || []).some((row) => row.hasTeam === true)).toBe(true)
  })

  it('blocks join when contest reaches max players capacity', async () => {
    const matchOptionsRes = await request(app).get(
      '/mock/admin/contest-match-options?tournamentId=t20wc-2026',
    )
    expect(matchOptionsRes.status).toBe(200)
    const scopedMatchIds = (matchOptionsRes.body || [])
      .filter((row) => String(row.status).toLowerCase() === 'notstarted')
      .slice(0, 2)
      .map((row) => row.id)
    expect(scopedMatchIds.length).toBe(2)

    const createRes = await request(app).post('/mock/admin/contests').send({
      name: 'Capacity Contest',
      tournamentId: 't20wc-2026',
      game: 'Fantasy',
      teams: 2,
      status: 'Open',
      joined: false,
      createdBy: 'master',
      matchIds: scopedMatchIds,
    })
    expect(createRes.status).toBe(201)
    const contestId = createRes.body.id

    const joinOne = await request(app)
      .post(`/mock/contests/${contestId}/join`)
      .send({ userId: 'kiran11' })
    expect(joinOne.status).toBe(200)

    const joinTwo = await request(app)
      .post(`/mock/contests/${contestId}/join`)
      .send({ userId: 'rahulxi' })
    expect(joinTwo.status).toBe(200)

    const joinThree = await request(app)
      .post(`/mock/contests/${contestId}/join`)
      .send({ userId: 'master' })
    expect(joinThree.status).toBe(403)
    expect(joinThree.body.message).toContain('full')

    const listRes = await request(app).get('/mock/contests').query({
      game: 'Fantasy',
      tournamentId: 't20wc-2026',
      userId: 'master',
      joined: false,
    })
    expect(listRes.status).toBe(200)
    const created = (listRes.body || []).find((row) => row.id === contestId)
    expect(created).toBeTruthy()
    expect(Number(created.joinedCount || 0)).toBe(2)
    expect(Number(created.maxPlayers || 0)).toBe(2)
    expect(created.hasCapacity).toBe(false)
    expect(created.joinOpen).toBe(false)

    const participantsRes = await request(app)
      .get(`/mock/contests/${contestId}/participants`)
      .query({ userId: 'master' })
    expect(participantsRes.status).toBe(200)
    expect(Array.isArray(participantsRes.body.participants)).toBe(true)
    expect(Number(participantsRes.body.joinedCount || 0)).toBe(2)
    expect(participantsRes.body.participants.length).toBe(0)
  })
})

describe('mock score permissions', () => {
  const getContestManagerUserId = async () => {
    const usersRes = await request(app).get('/mock/admin/users')
    expect(usersRes.status).toBe(200)
    const contestManager = (usersRes.body || []).find(
      (row) => row.gameName === 'contestmgr',
    )
    expect(contestManager).toBeTruthy()
    return contestManager.id
  }
  const getAssignedContest = async () => {
    const contestsRes = await request(app).get('/mock/contests')
    expect(contestsRes.status).toBe(200)
    const firstContest = (contestsRes.body || [])[0]
    expect(firstContest).toBeTruthy()
    return firstContest
  }

  it('rejects contest_manager score updates for unassigned contests', async () => {
    const contestManagerUserId = await getContestManagerUserId()
    const assignedContest = await getAssignedContest()
    const unassignedContestId = `${assignedContest.id}-other`
    const patchRole = await request(app)
      .patch(`/mock/admin/users/${contestManagerUserId}`)
      .send({
        actorUserId: '1',
        role: 'contest_manager',
        contestManagerContestId: assignedContest.id,
        status: 'active',
      })
    expect(patchRole.status).toBe(200)
    expect(patchRole.body.role).toBe('contest_manager')

    const forbiddenRes = await request(app)
      .post('/mock/admin/match-scores/upsert')
      .send({
        tournamentId: assignedContest.tournamentId,
        contestId: unassignedContestId,
        matchId: 'm1',
        userId: 'contestmgr',
        playerStats: [
          {
            playerName: 'Suryakumar Yadav',
            runs: 50,
            fours: 4,
            sixes: 2,
            wickets: 0,
            catches: 1,
          },
        ],
      })
    expect(forbiddenRes.status).toBe(403)
    expect(forbiddenRes.body.message).toContain('Score manager')
  })

  it('allows contest_manager score updates for assigned contest', async () => {
    const contestManagerUserId = await getContestManagerUserId()
    const assignedContest = await getAssignedContest()
    const patchRole = await request(app)
      .patch(`/mock/admin/users/${contestManagerUserId}`)
      .send({
        actorUserId: '1',
        role: 'contest_manager',
        contestManagerContestId: assignedContest.id,
        status: 'active',
      })
    expect(patchRole.status).toBe(200)
    expect(patchRole.body.contestManagerContestId).toBe(assignedContest.id)

    const okRes = await request(app)
      .post('/mock/admin/match-scores/upsert')
      .send({
        tournamentId: assignedContest.tournamentId,
        contestId: assignedContest.id,
        matchId: 'm1',
        userId: 'contestmgr',
        playerStats: [
          {
            playerName: 'Suryakumar Yadav',
            runs: 58,
            fours: 5,
            sixes: 3,
            wickets: 0,
            catches: 0,
          },
          {
            playerName: 'Monank Patel',
            runs: 31,
            fours: 3,
            sixes: 1,
            wickets: 0,
            catches: 0,
          },
        ],
      })
    expect(okRes.status).toBe(200)
    expect(okRes.body.ok).toBe(true)
    expect(okRes.body.savedScore?.matchId).toBe('m1')
  }, 60000)

  it('blocks admin from editing another user full team, allows master', async () => {
    const saveByAdmin = await request(app).post('/mock/team-selection/save').send({
      contestId: 'huntercherry',
      matchId: 'm1',
      userId: 'kiran11',
      actorUserId: 'admin',
      playingXi: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'],
      backups: ['p12'],
    })
    expect(saveByAdmin.status).toBe(403)
    expect((saveByAdmin.body.message || '').toLowerCase()).toContain('master')

    const saveByMaster = await request(app).post('/mock/team-selection/save').send({
      contestId: 'huntercherry',
      matchId: 'm1',
      userId: 'kiran11',
      actorUserId: 'master@myxi.local',
      playingXi: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'],
      backups: ['p12'],
    })
    expect(saveByMaster.status).toBe(200)
    expect(saveByMaster.body.ok).toBe(true)
  })
})
