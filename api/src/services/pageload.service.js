import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'

const factory = createRepositoryFactory()
const emptyPointsRuleTemplate = { batting: [], bowling: [], fielding: [] }

const loadPointsRuleTemplate = async () => {
  const scoringRules = await dbQuery(`SELECT rules FROM scoring_rules LIMIT 1`)
  return scoringRules.rows[0]
    ? typeof scoringRules.rows[0].rules === 'string'
      ? JSON.parse(scoringRules.rows[0].rules)
      : scoringRules.rows[0].rules
    : emptyPointsRuleTemplate
}

class PageLoadService {
  async getPageLoadData(userId) {
    try {
      // Get all tournaments
      const tournamentRepo = await factory.getTournamentRepository()
      const tournaments = await tournamentRepo.findAll()

      // Get contests user has joined
      let joinedContests = []
      if (userId) {
        const contestRepo = await factory.getContestRepository()
        const allContests = await contestRepo.findAll()
        // Filter contests joined by user (future: implement contest_joins repo)
        joinedContests = allContests.slice(0, 5) // TODO: filter by user
      }

      // Get points rule template (from first scoring rule or default)
      const pointsRuleTemplate = await loadPointsRuleTemplate()

      // Get admin manager status (simplified)
      const adminManager = { role: 'admin', status: 'active' }

      // Get master console (simplified)
      const masterConsole = {
        users: { total: 0, active: 0, pending: 0 },
        contests: { total: 0, active: 0 },
        matches: { total: 0, completed: 0 },
      }

      // Get audit logs
      const auditLogs = []

      return {
        tournaments,
        joinedContests,
        pointsRuleTemplate,
        adminManager,
        masterConsole,
        auditLogs,
        source: 'db',
      }
    } catch (error) {
      console.error('Error in pageload:', error)
      return {
        tournaments: [],
        joinedContests: [],
        pointsRuleTemplate: emptyPointsRuleTemplate,
        source: 'db',
      }
    }
  }

  async getBootstrapData() {
    try {
      const tournamentRepository = await factory.getTournamentRepository()
      const contestRepository = await factory.getContestRepository()
      const tournaments = await tournamentRepository.findAll()
      const allContests = await contestRepository.findAll()
      const pointsRuleTemplate = await loadPointsRuleTemplate()

      return {
        tournaments,
        contests: allContests,
        pointsRuleTemplate,
        source: 'db',
      }
    } catch (error) {
      console.error('Error in bootstrap:', error)
      return {
        tournaments: [],
        contests: [],
        pointsRuleTemplate: emptyPointsRuleTemplate,
        source: 'db',
      }
    }
  }
}

export default new PageLoadService()
