import { createRepositoryFactory } from '../repositories/repository.factory.js'

const factory = createRepositoryFactory()

class MatchService {
  async getMatch(id) {
    const repo = await factory.getMatchRepository()
    return await repo.findById(id)
  }

  async getMatchesByTournament(tournamentId) {
    const repo = await factory.getMatchRepository()
    return await repo.findByTournament(tournamentId)
  }

  async importFixtures(tournamentId, fixtures) {
    // fixtures: array of { name, teamA, teamB, teamAKey, teamBKey, startTime, status }
    const repo = await factory.getMatchRepository()
    const matchData = fixtures.map((f) => ({
      ...f,
      tournamentId,
    }))
    return await repo.bulkCreate(matchData)
  }

  async updateMatchStatus(id, status) {
    const repo = await factory.getMatchRepository()
    return await repo.updateStatus(id, status)
  }

  async uploadScore(matchId, tournamentId, playerStats, uploadedBy) {
    const scoreRepo = await factory.getMatchScoreRepository()
    // Deactivate previous score
    await scoreRepo.deactivatePrevious(matchId)
    // Create new score
    return await scoreRepo.create({
      matchId,
      tournamentId,
      playerStats,
      uploadedBy,
    })
  }

  async getScoreHistory(matchId) {
    const repo = await factory.getMatchScoreRepository()
    return await repo.findByMatch(matchId)
  }

  async rollbackScore(matchId, scoreId) {
    const scoreRepo = await factory.getMatchScoreRepository()
    // Find previous score or mark latest as inactive
    const history = await scoreRepo.findByMatch(matchId)
    if (history.length < 2) return null
    // Deactivate the scoreId, activate the previous one
    await scoreRepo.update(scoreId, { active: false })
    if (history[1]) {
      await scoreRepo.update(history[1].id, { active: true })
    }
    return await scoreRepo.findLatestActive(matchId)
  }

  async autoSwapPlayers(matchId, userId, swaps) {
    // swaps format: { out: playerId, in: playerId }
    // This would update team selection if match is still open
    // Placeholder for complex logic
    return { matchId, userId, swaps, applied: true }
  }
}

export default new MatchService()
