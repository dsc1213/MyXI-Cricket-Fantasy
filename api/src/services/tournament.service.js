import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import {
  buildImportedTournamentPayload,
  mapMatchWithDerivedStatus,
} from './tournamentImport.service.js'

const factory = createRepositoryFactory()

class TournamentService {
  async getAllTournaments() {
    const repo = await factory.getTournamentRepository()
    return await repo.findAll()
  }

  async getVisibleTournaments() {
    const rows = await this.getAllTournaments()
    return rows.filter((tournament) => {
      const status = (tournament?.status || '').toString().trim().toLowerCase()
      return status === 'active'
    })
  }

  async getTournamentById(id) {
    const repo = await factory.getTournamentRepository()
    return await repo.findById(id)
  }

  async createTournament(data) {
    const repo = await factory.getTournamentRepository()
    return await repo.create(data)
  }

  async createImportedTournament(payload) {
    const repo = await factory.getTournamentRepository()
    const matchRepo = await factory.getMatchRepository()
    const playerRepo = await factory.getPlayerRepository()

    const requestedTournamentId = (payload?.tournamentId || '').toString().trim()
    if (requestedTournamentId) {
      const existing = await repo.findBySourceKey(requestedTournamentId)
      if (existing) {
        const error = new Error('Tournament already exists')
        error.statusCode = 409
        throw error
      }
    }

    const { tournament, matches } = buildImportedTournamentPayload({
      payload,
      fallbackSeason: payload?.season || '2026',
      fallbackSource: payload?.source || 'manual',
      requestedTournamentId,
      getFallbackSquad: () => null,
    })

    const createdTournament = await repo.create({
      name: tournament.name,
      season: tournament.season,
      sourceKey: tournament.id,
      source: tournament.source,
      tournamentType: tournament.tournamentType,
      country: tournament.country,
      league: tournament.league,
      selectedTeams: tournament.selectedTeams,
      // New imports stay hidden until admin explicitly enables them.
      status: 'inactive',
    })

    const persistedMatches = await matchRepo.bulkCreate(
      matches.map((match) => ({
        tournamentId: createdTournament.id,
        name: match.name,
        teamA: match.home,
        teamB: match.away,
        teamAKey: match.home,
        teamBKey: match.away,
        startTime: match.startAt,
        sourceKey: match.sourceKey,
        status: match.status,
      })),
    )

    if (typeof playerRepo.upsertTeamSquadMeta === 'function' && tournament.selectedTeams.length) {
      await Promise.all(
        tournament.selectedTeams.map((teamCode) =>
          playerRepo.upsertTeamSquadMeta({
            teamCode,
            teamName: teamCode,
            tournamentType: tournament.tournamentType,
            country: tournament.country,
            league: tournament.league,
            tournament: tournament.name,
            source: tournament.source,
          }),
        ),
      )
    }

    return {
      ok: true,
      tournament: {
        ...createdTournament,
        matchesCount: persistedMatches.length,
      },
      matchesImported: persistedMatches.length,
    }
  }

  async updateTournament(id, data) {
    const repo = await factory.getTournamentRepository()
    return await repo.update(id, data)
  }

  async deleteTournament(id) {
    const repo = await factory.getTournamentRepository()
    const tournament = await repo.findById(id)
    if (!tournament) {
      return { ok: false, removedTournamentId: null, removedContests: 0 }
    }
    const countResult = await dbQuery(
      `SELECT COUNT(*)::int AS count
       FROM contests
       WHERE tournament_id = $1`,
      [id],
    )
    const deleted = await repo.delete(id)
    return {
      ok: Boolean(deleted),
      removedTournamentId: deleted ? String(id) : null,
      removedContests: Number(countResult.rows[0]?.count || 0),
    }
  }

  async getTournamentMatches(tournamentId) {
    const matchRepo = await factory.getMatchRepository()
    const matches = await matchRepo.findByTournament(tournamentId)
    return matches.map((match) => mapMatchWithDerivedStatus(match))
  }

  async getTournamentCatalog() {
    const tournaments = await this.getAllTournaments()
    const matchRepo = await factory.getMatchRepository()
    const rows = await Promise.all(
      tournaments.map(async (tournament) => {
        const matches = await matchRepo.findByTournament(tournament.id)
        const contestSummaryResult = await dbQuery(
          `SELECT
             COUNT(*)::int AS "contestsCount",
             COALESCE(
               BOOL_OR(COALESCE(status, '') !~* '^completed$'),
               false
             ) AS "hasActiveContests"
           FROM contests
           WHERE tournament_id = $1`,
          [tournament.id],
        )
        const contestSummary = contestSummaryResult.rows[0] || {}
        const teamCodes = [
          ...new Set(
            (matches || [])
              .flatMap((match) => [match.teamAKey || match.teamA, match.teamBKey || match.teamB])
              .filter(Boolean),
          ),
        ]
        return {
          ...tournament,
          enabled: (tournament.status || '').toString().trim().toLowerCase() === 'active',
          selectedTeams:
            Array.isArray(tournament.selectedTeams) && tournament.selectedTeams.length
              ? tournament.selectedTeams
              : teamCodes,
          teamCodes,
          matchesCount: matches.length,
          contestsCount: Number(contestSummary.contestsCount || 0),
          hasActiveContests: Boolean(contestSummary.hasActiveContests),
          lastUpdatedAt: tournament.updatedAt || null,
        }
      }),
    )
    return rows
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
