// Mock repository wraps mockProviderContext data for contests
class ContestMockRepository {
  constructor(context) {
    this.mockContests = context.mockContests || []
    this.mockContestCatalog = context.mockContestCatalog || new Map()
  }

  async findAll() {
    return this.mockContests.map((c) => this._toDto(c))
  }

  async findById(id) {
    const c = this.mockContests.find((item) => item.id === id)
    if (!c) return null
    return this._toDto(c)
  }

  async findByTournament(tournamentId) {
    return this.mockContests
      .filter((c) => c.tournamentId === tournamentId)
      .map((c) => this._toDto(c))
  }

  async create(data) {
    const id = `c${Date.now()}`
    const contest = {
      id,
      tournamentId: data.tournamentId,
      name: data.name,
      matchIds: Array.isArray(data.matchIds) ? [...data.matchIds] : [],
      prizeStructure: data.prizeStructure || {},
      status: data.status || 'open',
      entryFee: data.entryFee || 0,
      maxParticipants: data.maxParticipants || 1000,
      participantsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.mockContests.push(contest)
    this.mockContestCatalog.set(id, { ...contest })
    return this._toDto(contest)
  }

  async update(id, data) {
    const c = this.mockContests.find((item) => item.id === id)
    if (!c) return null

    if (data.name !== undefined) c.name = data.name
    if (data.status !== undefined) c.status = data.status
    if (data.entryFee !== undefined) c.entryFee = data.entryFee
    if (data.maxParticipants !== undefined) c.maxParticipants = data.maxParticipants
    if (data.prizeStructure !== undefined) c.prizeStructure = data.prizeStructure
    c.updatedAt = new Date().toISOString()

    this.mockContestCatalog.set(id, { ...c })
    return this._toDto(c)
  }

  async delete(id) {
    const index = this.mockContests.findIndex((item) => item.id === id)
    if (index === -1) return null

    const [deleted] = this.mockContests.splice(index, 1)
    this.mockContestCatalog.delete(id)
    return this._toDto(deleted)
  }

  async incrementParticipants(id) {
    const c = this.mockContests.find((item) => item.id === id)
    if (!c) return null

    c.participantsCount = (c.participantsCount || 0) + 1
    c.updatedAt = new Date().toISOString()
    return this._toDto(c)
  }

  async decrementParticipants(id) {
    const c = this.mockContests.find((item) => item.id === id)
    if (!c) return null

    c.participantsCount = Math.max(0, (c.participantsCount || 1) - 1)
    c.updatedAt = new Date().toISOString()
    return this._toDto(c)
  }

  _toDto(contest) {
    return {
      id: contest.id,
      tournamentId: contest.tournamentId,
      name: contest.name,
      matchIds: Array.isArray(contest.matchIds) ? [...contest.matchIds] : [],
      prizeStructure: contest.prizeStructure || {},
      status: contest.status,
      entryFee: contest.entryFee,
      maxParticipants: contest.maxParticipants,
      participantsCount: contest.participantsCount || 0,
      createdAt: contest.createdAt,
      updatedAt: contest.updatedAt,
    }
  }
}

export { ContestMockRepository }
