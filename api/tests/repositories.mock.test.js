import { describe, it, expect, beforeEach } from 'vitest'
import { TournamentMockRepository } from '../src/repositories/mock/tournament.mock.repository.js'
import { ContestMockRepository } from '../src/repositories/mock/contest.mock.repository.js'
import { MatchMockRepository } from '../src/repositories/mock/match.mock.repository.js'
import { TeamSelectionMockRepository } from '../src/repositories/mock/team-selection.mock.repository.js'
import { PlayerMockRepository } from '../src/repositories/mock/player.mock.repository.js'
import { ScoringRuleMockRepository } from '../src/repositories/mock/scoring-rule.mock.repository.js'
import { MatchScoreMockRepository } from '../src/repositories/mock/match-score.mock.repository.js'
import { UserMockRepository } from '../src/repositories/mock/user.mock.repository.js'

describe('Mock Repository Coverage', () => {
  it('TournamentMockRepository basic CRUD', async () => {
    const repo = new TournamentMockRepository({
      mockTournaments: [],
      enabledTournamentIds: new Set(),
    })
    const created = await repo.create({ name: 'T1', sourceKey: 'sk1' })
    expect(created.name).toBe('T1')
    const all = await repo.findAll()
    expect(all.length).toBe(1)
    const found = await repo.findById(created.id)
    expect(found.id).toBe(created.id)
    await repo.update(created.id, { name: 'T2' })
    const updated = await repo.findById(created.id)
    expect(updated.name).toBe('T2')
    await repo.delete(created.id)
    expect((await repo.findAll()).length).toBe(0)
  })

  it('ContestMockRepository basic CRUD', async () => {
    const repo = new ContestMockRepository({
      mockContests: [],
      mockContestCatalog: new Map(),
    })
    const created = await repo.create({ name: 'C1', tournamentId: 'T1' })
    expect(created.name).toBe('C1')
    const all = await repo.findAll()
    expect(all.length).toBe(1)
    const found = await repo.findById(created.id)
    expect(found.id).toBe(created.id)
    await repo.update(created.id, { name: 'C2' })
    const updated = await repo.findById(created.id)
    expect(updated.name).toBe('C2')
    await repo.delete(created.id)
    expect((await repo.findAll()).length).toBe(0)
  })

  it('MatchMockRepository basic CRUD', async () => {
    const repo = new MatchMockRepository({ customTournamentMatches: {} })
    const created = await repo.create({ tournamentId: 'T1', name: 'M1' })
    expect(created.name).toBe('M1')
    const all = await repo.findAll()
    expect(all.length).toBe(1)
    const found = await repo.findById(created.id)
    expect(found.id).toBe(created.id)
  })

  it('TeamSelectionMockRepository basic CRUD', async () => {
    const repo = new TeamSelectionMockRepository({ mockTeamSelections: new Map() })
    const created = await repo.create({
      matchId: 'M1',
      userId: 'U1',
      playingXi: [1, 2],
      backups: [3],
    })
    expect(created.matchId).toBe('M1')
    const found = await repo.findByMatchAndUser('M1', 'U1')
    expect(found.userId).toBe('U1')
    await repo.update('M1', 'U1', { playingXi: [4, 5] })
    const updated = await repo.findByMatchAndUser('M1', 'U1')
    expect(updated.playingXi).toContain(4)
    await repo.delete('M1', 'U1')
    expect(await repo.findByMatchAndUser('M1', 'U1')).toBeNull()
  })

  it('PlayerMockRepository basic CRUD', async () => {
    const repo = new PlayerMockRepository({ players: [], allKnownPlayers: [] })
    const created = await repo.create({
      firstName: 'F',
      lastName: 'L',
      role: 'B',
      team: 'T',
      teamKey: 'T',
      playerId: 'P1',
    })
    expect(created.firstName).toBe('F')
    const all = await repo.findAll()
    expect(all.length).toBe(1)
    const found = await repo.findById(created.id)
    expect(found.id).toBe(created.id)
    await repo.delete(created.id)
    expect((await repo.findAll()).length).toBe(0)
  })

  it('ScoringRuleMockRepository basic CRUD', async () => {
    const repo = new ScoringRuleMockRepository({ store: {} })
    const created = await repo.create({
      tournamentId: 'T1',
      rules: { batting: [], bowling: [], fielding: [] },
    })
    expect(created.tournamentId).toBe('T1')
    const found = await repo.findByTournament('T1')
    expect(found.tournamentId).toBe('T1')
    await repo.update(created.id, { rules: { batting: [1], bowling: [], fielding: [] } })
    const updated = await repo.findByTournament('T1')
    expect(updated.rules.batting).toContain(1)
    await repo.delete(created.id)
    expect(await repo.findByTournament('T1')).toBeNull()
  })

  it('MatchScoreMockRepository basic CRUD', async () => {
    const repo = new MatchScoreMockRepository({ matchScores: [] })
    const created = await repo.create({
      matchId: 'M1',
      tournamentId: 'T1',
      uploadedBy: 'U1',
      playerStats: [],
    })
    expect(created.matchId).toBe('M1')
    const found = await repo.findById(created.id)
    expect(found.id).toBe(created.id)
    await repo.update(created.id, { playerStats: [1, 2] })
    const updated = await repo.findById(created.id)
    expect(updated.playerStats).toContain(1)
    await repo.delete(created.id)
    expect(await repo.findById(created.id)).toBeNull()
  })

  it('UserMockRepository basic CRUD', async () => {
    const repo = new UserMockRepository({ users: [] })
    const created = await repo.createUser({
      name: 'U',
      userId: 'U1',
      gameName: 'U1',
      email: 'u@x.com',
      passwordHash: 'h',
      role: 'user',
      status: 'pending',
    })
    expect(created.name).toBe('U')
    const found = await repo.findById(created.id)
    expect(found.name).toBe('U')
    await repo.update(created.id, { name: 'U2' })
    const updated = await repo.findById(created.id)
    expect(updated.name).toBe('U2')
    await repo.delete(created.id)
    expect(await repo.findById(created.id)).toBeNull()
  })
})
