import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import scoringRuleService from './scoring-rule.service.js'
import contestService, { buildContestView } from './contest.service.js'
import { cloneDefaultPointsRules } from '../default-points-rules.js'
import userRepository from '../repositories/user.repository.js'
import auditLogService from './audit-log.service.js'

const factory = createRepositoryFactory()
const emptyPointsRuleTemplate = cloneDefaultPointsRules()

const loadPointsRuleTemplate = async () => {
  const globalRules = await scoringRuleService.getDefaultScoringRules()
  return globalRules?.rules || cloneDefaultPointsRules()
}

const resolveUserId = async (rawIdentifier) => {
  const value = (rawIdentifier ?? '').toString().trim()
  if (!value) return null
  const asNumber = Number(value)
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber
  }
  const user = await userRepository.findByIdentifier(value)
  return Number(user?.id || 0) || null
}

class PageLoadService {
  async getJoinedContestsForUser(userIdentifier) {
    const userId = await resolveUserId(userIdentifier)
    if (!userId) return []

    const joinedContestIdsResult = await dbQuery(
      `SELECT DISTINCT contest_id as "contestId"
       FROM contest_joins
       WHERE user_id = $1
       UNION
       SELECT DISTINCT contest_id as "contestId"
       FROM contest_fixed_rosters
       WHERE user_id = $1
       UNION
       SELECT DISTINCT contest_id as "contestId"
       FROM team_selections
       WHERE user_id = $1`,
      [userId],
    )

    const joinedContestIds = new Set(
      (joinedContestIdsResult.rows || []).map((row) => String(row.contestId)),
    )
    if (!joinedContestIds.size) return []

    const contestRepo = await factory.getContestRepository()
    const allContests = await contestRepo.findAll()
    const joinedRows = (allContests || []).filter((contest) =>
      joinedContestIds.has(String(contest.id)),
    )
    const viewerStatsByContest = await contestService.getContestViewerStatsMap(
      joinedRows.map((contest) => contest.id),
      userId,
    )

    const joinedContests = await Promise.all(
      joinedRows.map(async (contest) => {
        const [participantPayload, scoreMeta] = await Promise.all([
          contestService.getContestParticipants(contest.id),
          contestService.getContestLastScoreMeta(contest),
        ])
        const participantRows = Array.isArray(participantPayload?.participants)
          ? participantPayload.participants
          : []
        const joinedCount = Number(
          participantPayload?.joinedCount || participantRows.length || 0,
        )
        return buildContestView(contest, {
          joined: true,
          joinedCount,
          participants: joinedCount,
          ...(viewerStatsByContest.get(String(contest.id)) || {}),
          ...scoreMeta,
        })
      }),
    )

    return joinedContests
  }

  async getPageLoadData(userId) {
    try {
      // Get all tournaments
      const tournamentRepo = await factory.getTournamentRepository()
      const tournaments = await tournamentRepo.findAll()

      // Get contests user has joined
      const joinedContests = userId ? await this.getJoinedContestsForUser(userId) : []

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

      const auditLogs = await auditLogService.listRecent()

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
        pointsRuleTemplate: cloneDefaultPointsRules(),
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
        pointsRuleTemplate: cloneDefaultPointsRules(),
        source: 'db',
      }
    }
  }
}

export default new PageLoadService()
