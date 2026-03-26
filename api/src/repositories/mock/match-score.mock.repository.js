// Mock repository wraps mockProviderContext data for match scores
class MatchScoreMockRepository {
  constructor(context) {
    this.matchScores = context.matchScores || []
  }

  async findByMatch(matchId) {
    return this.matchScores
      .filter((s) => s.matchId === matchId)
      .map((s) => this._toDto(s))
  }

  async findLatestActive(matchId) {
    const active = this.matchScores
      .filter((s) => s.matchId === matchId && s.active)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return active.length > 0 ? this._toDto(active[0]) : null
  }

  async findById(id) {
    const s = this.matchScores.find((item) => item.id === id)
    if (!s) return null
    return this._toDto(s)
  }

  async create(data) {
    // First, deactivate previous scores for this match
    const previousScores = this.matchScores.filter(
      (s) => s.matchId === data.matchId && s.active,
    )
    previousScores.forEach((s) => {
      s.active = false
    })

    const id = `ms${Date.now()}`
    const score = {
      id,
      matchId: data.matchId,
      tournamentId: data.tournamentId,
      uploadedBy: data.uploadedBy,
      playerStats: data.playerStats || [],
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.matchScores.push(score)
    return this._toDto(score)
  }

  async deactivatePrevious(matchId) {
    const deactivated = []
    this.matchScores
      .filter((s) => s.matchId === matchId && s.active)
      .forEach((s) => {
        s.active = false
        s.updatedAt = new Date().toISOString()
        deactivated.push(this._toDto(s))
      })

    return deactivated
  }

  async update(id, data) {
    const s = this.matchScores.find((item) => item.id === id)
    if (!s) return null

    if (data.playerStats !== undefined) s.playerStats = data.playerStats
    if (data.active !== undefined) s.active = data.active
    s.updatedAt = new Date().toISOString()

    return this._toDto(s)
  }

  async delete(id) {
    const index = this.matchScores.findIndex((item) => item.id === id)
    if (index === -1) return null

    const [deleted] = this.matchScores.splice(index, 1)
    return this._toDto(deleted)
  }

  _toDto(score) {
    return {
      id: score.id,
      matchId: score.matchId,
      tournamentId: score.tournamentId,
      uploadedBy: score.uploadedBy,
      playerStats: Array.isArray(score.playerStats) ? [...score.playerStats] : [],
      active: score.active || false,
      createdAt: score.createdAt,
      updatedAt: score.updatedAt,
    }
  }
}

export { MatchScoreMockRepository }
