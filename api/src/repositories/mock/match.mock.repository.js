// Mock repository wraps mockProviderContext data for matches
class MatchMockRepository {
  constructor(context) {
    this.customTournamentMatches = context.customTournamentMatches
  }

  async findAll() {
    const all = []
    for (const matches of Object.values(this.customTournamentMatches)) {
      if (Array.isArray(matches)) {
        all.push(...matches.map((m) => this._toDto(m)))
      }
    }
    return all
  }

  async findById(id) {
    for (const matches of Object.values(this.customTournamentMatches)) {
      if (Array.isArray(matches)) {
        const m = matches.find((item) => item.id === id)
        if (m) return this._toDto(m)
      }
    }
    return null
  }

  async findByTournament(tournamentId) {
    const matches = this.customTournamentMatches[tournamentId] || []
    return matches.map((m) => this._toDto(m))
  }

  async create(data) {
    const tournamentId = data.tournamentId
    if (!this.customTournamentMatches[tournamentId]) {
      this.customTournamentMatches[tournamentId] = []
    }

    const id = `m${Date.now()}`
    const match = {
      id,
      tournamentId,
      matchNo: data.matchNo || 0,
      home: data.home,
      away: data.away,
      teamAKey: data.teamAKey,
      teamBKey: data.teamBKey,
      name: data.name,
      date: data.date,
      startAt: data.startAt,
      status: data.status || 'notstarted',
      stage: data.stage || 'league',
      stageLabel: data.stageLabel || 'League',
      venue: data.venue,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.customTournamentMatches[tournamentId].push(match)
    return this._toDto(match)
  }

  async bulkCreate(tournamentId, fixtures) {
    if (!this.customTournamentMatches[tournamentId]) {
      this.customTournamentMatches[tournamentId] = []
    }

    const created = fixtures.map((fixture) => {
      const match = {
        id: fixture.id || `m${Date.now()}${Math.random()}`,
        tournamentId,
        ...fixture,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.customTournamentMatches[tournamentId].push(match)
      return this._toDto(match)
    })

    return created
  }

  async updateStatus(id, status) {
    for (const matches of Object.values(this.customTournamentMatches)) {
      if (Array.isArray(matches)) {
        const m = matches.find((item) => item.id === id)
        if (m) {
          m.status = status
          m.updatedAt = new Date().toISOString()
          return this._toDto(m)
        }
      }
    }
    return null
  }

  async delete(id) {
    for (const [tournamentId, matches] of Object.entries(this.customTournamentMatches)) {
      if (Array.isArray(matches)) {
        const index = matches.findIndex((item) => item.id === id)
        if (index !== -1) {
          const [deleted] = matches.splice(index, 1)
          return this._toDto(deleted)
        }
      }
    }
    return null
  }

  _toDto(match) {
    return {
      id: match.id,
      tournamentId: match.tournamentId,
      matchNo: match.matchNo,
      home: match.home,
      away: match.away,
      teamAKey: match.teamAKey || match.home,
      teamBKey: match.teamBKey || match.away,
      name: match.name,
      date: match.date,
      startAt: match.startAt,
      status: match.status,
      stage: match.stage,
      stageLabel: match.stageLabel,
      venue: match.venue,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    }
  }
}

export { MatchMockRepository }
