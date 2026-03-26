// Mock repository wraps mockProviderContext data for scoring rules
class ScoringRuleMockRepository {
  constructor(context) {
    this.store = context.store || {} // Fallback to empty store
  }

  async findAll() {
    const all = []
    for (const rule of Object.values(this.store)) {
      if (rule && typeof rule === 'object' && rule.tournamentId) {
        all.push(this._toDto(rule))
      }
    }
    return all
  }

  async findByTournament(tournamentId) {
    const rule = this.store[`rules:${tournamentId}`]
    if (!rule) return null
    return this._toDto(rule)
  }

  async findById(id) {
    for (const rule of Object.values(this.store)) {
      if (rule && rule.id === id) {
        return this._toDto(rule)
      }
    }
    return null
  }

  async create(data) {
    const id = `r${Date.now()}`
    const rule = {
      id,
      tournamentId: data.tournamentId,
      rules: data.rules || { batting: [], bowling: [], fielding: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.store[`rules:${data.tournamentId}`] = rule
    return this._toDto(rule)
  }

  async update(id, data) {
    let rule = null
    let key = null

    for (const [k, v] of Object.entries(this.store)) {
      if (v && v.id === id) {
        rule = v
        key = k
        break
      }
    }

    if (!rule) return null

    if (data.rules !== undefined) rule.rules = data.rules
    rule.updatedAt = new Date().toISOString()

    return this._toDto(rule)
  }

  async delete(id) {
    let rule = null
    let key = null

    for (const [k, v] of Object.entries(this.store)) {
      if (v && v.id === id) {
        rule = v
        key = k
        break
      }
    }

    if (!rule || !key) return null
    delete this.store[key]

    return this._toDto(rule)
  }

  _toDto(rule) {
    return {
      id: rule.id,
      tournamentId: rule.tournamentId,
      rules: rule.rules || { batting: [], bowling: [], fielding: [] },
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }
  }
}

export { ScoringRuleMockRepository }
