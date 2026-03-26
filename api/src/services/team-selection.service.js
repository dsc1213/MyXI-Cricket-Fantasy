import { createRepositoryFactory } from '../repositories/repository.factory.js'
import matchService from './match.service.js'

const factory = createRepositoryFactory()

class TeamSelectionService {
  async saveTeamSelection(matchId, userId, playingXi, backups) {
    // Validate match exists
    const match = await matchService.getMatch(matchId)
    if (!match) throw new Error('Match not found')

    const repo = await factory.getTeamSelectionRepository()
    // Check if selection already exists
    const existing = await repo.findByMatchAndUser(matchId, userId)
    if (existing) {
      return await repo.update(matchId, userId, { playingXi, backups })
    }
    return await repo.create({ matchId, userId, playingXi, backups })
  }

  async getUserTeamSelection(matchId, userId) {
    const repo = await factory.getTeamSelectionRepository()
    return await repo.findByMatchAndUser(matchId, userId)
  }

  async getMatchTeamSelections(matchId) {
    const repo = await factory.getTeamSelectionRepository()
    return await repo.findByMatch(matchId)
  }

  async getUserPicksByMatch(userId, matchId) {
    const repo = await factory.getTeamSelectionRepository()
    return await repo.findByMatchAndUser(matchId, userId)
  }
}

export default new TeamSelectionService()
