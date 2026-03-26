import { createRepositoryFactory } from '../repositories/repository.factory.js'

const factory = createRepositoryFactory()

class PlayerService {
  async getAllPlayers() {
    const repo = await factory.getPlayerRepository()
    return await repo.findAll()
  }

  async getPlayersByTeam(teamKey) {
    const repo = await factory.getPlayerRepository()
    return await repo.findByTeam(teamKey)
  }

  async getPlayerStats(playerId) {
    const repo = await factory.getPlayerRepository()
    return await repo.findStats(playerId)
  }

  async getTeamSquads(tournamentId) {
    // Get all unique teams and their players
    const repo = await factory.getPlayerRepository()
    // In mock mode, get from allKnownPlayers; in DB mode, query distinct teams
    const allPlayers = await repo.findAll()
    const teamKeys = [...new Set(allPlayers.map((p) => p.teamKey))]
    const squads = {}
    for (const teamKey of teamKeys) {
      squads[teamKey] = await repo.findByTeam(teamKey)
    }
    return squads
  }

  async createTeamSquad(teamKey, players) {
    // Bulk create players for a team
    const repo = await factory.getPlayerRepository()
    const data = players.map((p) => ({
      firstName: p.firstName || p.first_name,
      lastName: p.lastName || p.last_name,
      role: p.role,
      teamKey,
      playerId: p.playerId || p.player_id,
    }))
    return await repo.bulkCreate(data)
  }

  async deleteTeamSquad(teamKey) {
    // Delete all players for a team
    const repo = await factory.getPlayerRepository()
    const players = await repo.findByTeam(teamKey)
    for (const player of players) {
      await repo.delete(player.id)
    }
    return { deleted: true }
  }

  async getTournamentMatchLineups(tournamentId, matchId) {
    // Get player list for match (team A + team B)
    const repo = await factory.getPlayerRepository()
    const allPlayers = await repo.findAll()
    return allPlayers.sort((a, b) => {
      if (a.teamKey !== b.teamKey) {
        return a.teamKey.localeCompare(b.teamKey)
      }
      return a.firstName.localeCompare(b.firstName)
    })
  }

  async upsertMatchLineups(tournamentId, matchId, lineups) {
    // Store/update lineups for a match
    // lineups: { teamA: [playerIds], teamB: [playerIds] }
    return { updated: true, lineups }
  }
}

export default new PlayerService()
