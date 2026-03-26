import { createRepositoryFactory } from '../repositories/repository.factory.js'

const factory = createRepositoryFactory()

class ScoringRuleService {
  async getScoringRulesByTournament(tournamentId) {
    const repo = await factory.getScoringRuleRepository()
    return await repo.findByTournament(tournamentId)
  }

  async createScoringRule(tournamentId, rules) {
    const repo = await factory.getScoringRuleRepository()
    return await repo.create({ tournamentId, rules })
  }

  async updateScoringRule(id, rules) {
    const repo = await factory.getScoringRuleRepository()
    return await repo.update(id, { rules })
  }

  async saveScoringRules(tournamentId, rules) {
    // Get existing or create new
    const repo = await factory.getScoringRuleRepository()
    const existing = await repo.findByTournament(tournamentId)
    if (existing) {
      return await repo.update(existing.id, { rules })
    }
    return await repo.create({ tournamentId, rules })
  }
}

export default new ScoringRuleService()
