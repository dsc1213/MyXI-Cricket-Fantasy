import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { cloneDefaultPointsRules } from '../default-points-rules.js'

const factory = createRepositoryFactory()

class ScoringRuleService {
  async getDefaultScoringRules() {
    const repo = await factory.getScoringRuleRepository()
    const found = typeof repo.findDefault === 'function' ? await repo.findDefault() : null
    return found || { id: true, rules: cloneDefaultPointsRules() }
  }

  async saveDefaultScoringRules(rules) {
    const repo = await factory.getScoringRuleRepository()
    if (typeof repo.saveDefault === 'function') {
      const saved = await repo.saveDefault(rules || cloneDefaultPointsRules())
      const { default: matchScoreService } = await import('./match-score.service.js')
      const rebuildSummary = await matchScoreService.rebuildAllDerivedScores()
      return {
        ...saved,
        rebuildSummary,
      }
    }
    return { id: true, rules: rules || cloneDefaultPointsRules(), rebuildSummary: null }
  }

  async getScoringRulesByTournament(tournamentId) {
    const repo = await factory.getScoringRuleRepository()
    if (!tournamentId) {
      return this.getDefaultScoringRules()
    }
    const found = await repo.findByTournament(tournamentId)
    if (found) return found
    const globalDefault = await this.getDefaultScoringRules()
    return { id: null, tournamentId, rules: globalDefault.rules }
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
    if (!tournamentId) {
      return this.saveDefaultScoringRules(rules)
    }
    const repo = await factory.getScoringRuleRepository()
    const existing = await repo.findByTournament(tournamentId)
    if (existing) {
      return await repo.update(existing.id, { rules })
    }
    return await repo.create({ tournamentId, rules })
  }
}

export default new ScoringRuleService()
