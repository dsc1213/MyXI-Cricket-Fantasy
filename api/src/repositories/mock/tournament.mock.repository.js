// Mock repository wraps mockProviderContext data for tournaments
class TournamentMockRepository {
  constructor(context) {
    this.mockTournaments = context.mockTournaments
    this.enabledTournamentIds = context.enabledTournamentIds
  }

  async findAll() {
    return this.mockTournaments
      .filter((t) => this.enabledTournamentIds.has(t.id))
      .map((t) => this._toDto(t))
  }

  async findById(id) {
    const t = this.mockTournaments.find((item) => item.id === id)
    if (!t) return null
    return this._toDto(t)
  }

  async findBySourceKey(sourceKey) {
    const t = this.mockTournaments.find(
      (item) => item.sourceKey === sourceKey || item.source_key === sourceKey,
    )
    if (!t) return null
    return this._toDto(t)
  }

  async create(data) {
    const id = `t${Date.now()}`
    const tournament = {
      id,
      name: data.name,
      season: data.season || 'default',
      status: data.status || 'active',
      sourceKey: data.sourceKey,
      source_key: data.sourceKey,
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.mockTournaments.push(tournament)
    this.enabledTournamentIds.add(id)
    return this._toDto(tournament)
  }

  async update(id, data) {
    const t = this.mockTournaments.find((item) => item.id === id)
    if (!t) return null

    if (data.name !== undefined) t.name = data.name
    if (data.season !== undefined) t.season = data.season
    if (data.status !== undefined) t.status = data.status
    t.updatedAt = new Date().toISOString()
    t.updated_at = t.updatedAt

    return this._toDto(t)
  }

  async delete(id) {
    const index = this.mockTournaments.findIndex((item) => item.id === id)
    if (index === -1) return null

    const [deleted] = this.mockTournaments.splice(index, 1)
    this.enabledTournamentIds.delete(id)

    return this._toDto(deleted)
  }

  _toDto(tournament) {
    return {
      id: tournament.id,
      name: tournament.name,
      season: tournament.season,
      status: tournament.status,
      sourceKey: tournament.sourceKey || tournament.source_key,
      createdAt: tournament.createdAt || tournament.created_at,
      updatedAt: tournament.updatedAt || tournament.updated_at,
    }
  }
}

export { TournamentMockRepository }
