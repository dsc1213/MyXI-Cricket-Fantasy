import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { cloneDefaultPointsRules } from '../default-points-rules.js'

const factory = createRepositoryFactory()

class ScoringRuleService {
  // Returns the global default scoring rules used as fallback across tournaments.
  async getDefaultScoringRules() {
    const repo = await factory.getScoringRuleRepository()
    const found = typeof repo.findDefault === 'function' ? await repo.findDefault() : null
    return found || { id: true, rules: cloneDefaultPointsRules() }
  }

  // Saves global default scoring rules and triggers a derived-score rebuild.
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

  // Returns tournament scoring rules, falling back to global defaults when missing.
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

  // Creates a scoring rule record for a tournament.
  async createScoringRule(tournamentId, rules) {
    const repo = await factory.getScoringRuleRepository()
    return await repo.create({ tournamentId, rules })
  }

  // Updates an existing scoring rule record by id.
  async updateScoringRule(id, rules) {
    const repo = await factory.getScoringRuleRepository()
    return await repo.update(id, { rules })
  }

  // Upserts scoring rules for a tournament or global defaults when tournament is omitted.
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
