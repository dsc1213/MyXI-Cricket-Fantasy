// Mock repository wraps mockProviderContext data for players
class PlayerMockRepository {
  constructor(context) {
    this.players = context.players || []
    this.allKnownPlayers = context.allKnownPlayers || []
  }

  async findAll() {
    return this.allKnownPlayers.map((p) => this._toDto(p))
  }

  async findById(id) {
    const p = this.allKnownPlayers.find((item) => item.id === id)
    if (!p) return null
    return this._toDto(p)
  }

  async findByTeam(teamKey) {
    return this.allKnownPlayers
      .filter((p) => p.team === teamKey || p.teamKey === teamKey)
      .map((p) => this._toDto(p))
  }

  async findStats(playerId) {
    // Mock doesn't have detailed stats, return basic info
    const p = await this.findById(playerId)
    return p
  }

  async create(data) {
    const id = data.playerId || `p${Date.now()}`
    const player = {
      id,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      team: data.team,
      teamKey: data.teamKey,
      playerId: data.playerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.players.push(player)
    // Re-update allKnownPlayers to include new player
    const existing = this.allKnownPlayers.find((p) => p.id === player.id)
    if (!existing) {
      this.allKnownPlayers.push(player)
    }

    return this._toDto(player)
  }

  async bulkCreate(players) {
    const created = players.map((data) => {
      const id = data.playerId || `p${Date.now()}${Math.random()}`
      const player = {
        id,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        team: data.team,
        teamKey: data.teamKey,
        playerId: data.playerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      this.players.push(player)
      const existing = this.allKnownPlayers.find((p) => p.id === player.id)
      if (!existing) {
        this.allKnownPlayers.push(player)
      }

      return this._toDto(player)
    })

    return created
  }

  async delete(id) {
    const index = this.players.findIndex((item) => item.id === id)
    if (index === -1) return null

    const [deleted] = this.players.splice(index, 1)
    const catIndex = this.allKnownPlayers.findIndex((p) => p.id === id)
    if (catIndex !== -1) {
      this.allKnownPlayers.splice(catIndex, 1)
    }

    return this._toDto(deleted)
  }

  _toDto(player) {
    return {
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      role: player.role,
      team: player.team || player.teamKey,
      teamKey: player.teamKey,
      playerId: player.playerId,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
    }
  }
}

export { PlayerMockRepository }
