import { createRepositoryFactory } from '../repositories/repository.factory.js'

const factory = createRepositoryFactory()

class TournamentService {
  async getAllTournaments() {
    const repo = await factory.getTournamentRepository()
    return await repo.findAll()
  }

  async getTournamentById(id) {
    const repo = await factory.getTournamentRepository()
    return await repo.findById(id)
  }

  async createTournament(data) {
    const repo = await factory.getTournamentRepository()
    return await repo.create(data)
  }

  async updateTournament(id, data) {
    const repo = await factory.getTournamentRepository()
    return await repo.update(id, data)
  }

  async deleteTournament(id) {
    const repo = await factory.getTournamentRepository()
    return await repo.delete(id)
  }

  async getTournamentMatches(tournamentId) {
    const matchRepo = await factory.getMatchRepository()
    return await matchRepo.findByTournament(tournamentId)
  }

  async getTournamentLeaderboard(tournamentId) {
    // Get all matches for tournament
    const matchRepo = await factory.getMatchRepository()
    const scoringRuleRepo = await factory.getScoringRuleRepository()
    const teamSelectionRepo = await factory.getTeamSelectionRepository()
    const matchScoreRepo = await factory.getMatchScoreRepository()

    const matches = await matchRepo.findByTournament(tournamentId)
    const matchIds = matches.map((m) => m.id)
    if (matchIds.length === 0) return []

    // Get scoring rules
    const scoringRule = await scoringRuleRepo.findByTournament(tournamentId)
    const rules = scoringRule?.rules || { batting: [], bowling: [], fielding: [] }

    // Aggregate scores by user
    const leaderboard = {}
    for (const matchId of matchIds) {
      const teamSelections = await teamSelectionRepo.findByMatch(matchId)
      const scores = await matchScoreRepo.findByMatch(matchId)

      for (const selection of teamSelections) {
        if (!leaderboard[selection.userId]) {
          leaderboard[selection.userId] = { points: 0, matches: 0 }
        }
        leaderboard[selection.userId].matches++
      }

      // Compute points from active score
      for (const score of scores) {
        if (!score.active) continue
        const playerStats = score.playerStats || []
        for (const stat of playerStats) {
          // Apply rules based on stat type
          let pointsEarned = 0
          if (stat.type === 'batting') {
            const ruleItem = rules.batting?.find((r) => r.id === stat.id)
            pointsEarned = (ruleItem?.value || 0) * (stat.count || 0)
          } else if (stat.type === 'bowling') {
            const ruleItem = rules.bowling?.find((r) => r.id === stat.id)
            pointsEarned = (ruleItem?.value || 0) * (stat.count || 0)
          } else if (stat.type === 'fielding') {
            const ruleItem = rules.fielding?.find((r) => r.id === stat.id)
            pointsEarned = (ruleItem?.value || 0) * (stat.count || 0)
          }
          // Add points to users who have this player in their team
          for (const selection of teamSelections) {
            const hasPlayer = [
              ...(selection.playingXi || []),
              ...(selection.backups || []),
            ].includes(stat.playerId)
            if (hasPlayer && leaderboard[selection.userId]) {
              leaderboard[selection.userId].points += pointsEarned
            }
          }
        }
      }
    }

    // Convert to array and sort
    return Object.entries(leaderboard)
      .map(([userId, data]) => ({
        userId: Number(userId),
        ...data,
      }))
      .sort((a, b) => b.points - a.points)
  }

  async selectTournament(tournamentId) {
    const tournament = await this.getTournamentById(tournamentId)
    if (!tournament) throw new Error('Tournament not found')
    return tournament
  }
}

export default new TournamentService()
