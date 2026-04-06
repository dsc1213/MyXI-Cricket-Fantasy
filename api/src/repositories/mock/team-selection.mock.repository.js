// Mock repository wraps mockProviderContext data for team selections
class TeamSelectionMockRepository {
  constructor(context) {
    this.mockTeamSelections = context.mockTeamSelections
  }

  _makeKey(matchId, userId) {
    return `${matchId}:${userId}`
  }

  async findByMatchAndUser(matchId, userId) {
    const key = this._makeKey(matchId, userId)
    const ts = this.mockTeamSelections.get(key)
    if (!ts) return null
    return this._toDto(ts)
  }

  async findByMatch(matchId) {
    const results = []
    for (const [key, ts] of this.mockTeamSelections.entries()) {
      if (key.startsWith(`${matchId}:`)) {
        results.push(this._toDto(ts))
      }
    }
    return results
  }

  async findByUser(userId) {
    const results = []
    for (const [key, ts] of this.mockTeamSelections.entries()) {
      if (key.endsWith(`:${userId}`)) {
        results.push(this._toDto(ts))
      }
    }
    return results
  }

  async create(data) {
    const key = this._makeKey(data.matchId, data.userId)
    const ts = {
      matchId: data.matchId,
      userId: data.userId,
      playingXi: Array.isArray(data.playingXi) ? [...data.playingXi] : [],
      backups: Array.isArray(data.backups) ? [...data.backups] : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.mockTeamSelections.set(key, ts)
    return this._toDto(ts)
  }

  async update(matchId, userId, data) {
    const key = this._makeKey(matchId, userId)
    const ts = this.mockTeamSelections.get(key)
    if (!ts) return null

    if (data.playingXi !== undefined)
      ts.playingXi = Array.isArray(data.playingXi) ? [...data.playingXi] : []
    if (data.backups !== undefined)
      ts.backups = Array.isArray(data.backups) ? [...data.backups] : []
    ts.updatedAt = new Date().toISOString()

    return this._toDto(ts)
  }

  async delete(matchId, userId) {
    const key = this._makeKey(matchId, userId)
    const ts = this.mockTeamSelections.get(key)
    if (!ts) return null

    this.mockTeamSelections.delete(key)
    return this._toDto(ts)
  }

  _toDto(ts) {
    return {
      matchId: ts.matchId,
      userId: ts.userId,
      playingXi: Array.isArray(ts.playingXi) ? [...ts.playingXi] : [],
      backups: Array.isArray(ts.backups) ? [...ts.backups] : [],
      createdAt: ts.createdAt,
      updatedAt: ts.updatedAt,
    }
  }
}

export { TeamSelectionMockRepository }
