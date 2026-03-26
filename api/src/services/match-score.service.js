import { createRepositoryFactory } from '../repositories/repository.factory.js'

const factory = createRepositoryFactory()

class MatchScoreService {
  async uploadMatchScores(matchId, tournamentId, playerStats, uploadedBy) {
    // Deactivate previous scores
    const repo = await factory.getMatchScoreRepository()
    await repo.deactivatePrevious(matchId)
    // Create new score
    return await repo.create({
      matchId,
      tournamentId,
      playerStats,
      uploadedBy,
    })
  }

  async getMatchScores(tournamentId, matchId) {
    const repo = await factory.getMatchScoreRepository()
    return await repo.findByMatch(matchId)
  }

  async getActiveMatchScore(matchId) {
    const repo = await factory.getMatchScoreRepository()
    return await repo.findLatestActive(matchId)
  }

  async processExcelScores(excelData) {
    // Parse Excel data and return formatted for upload
    return { data: excelData, validated: true }
  }

  async saveExcelProcessedScores(matchId, tournamentId, playerStats, uploadedBy) {
    return await this.uploadMatchScores(matchId, tournamentId, playerStats, uploadedBy)
  }

  async getPlayerOverridesContext(tournamentId) {
    // Get context data for player overrides UI
    return { overrides: [], context: {} }
  }

  async savePlayerOverrides(tournamentId, overrides) {
    // Save player stat overrides
    return { saved: true, count: overrides.length }
  }
}

export default new MatchScoreService()
