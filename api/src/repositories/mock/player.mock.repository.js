// Mock repository wraps mockProviderContext data for players
class PlayerMockRepository {
  constructor(context) {
    this.context = context
    this.players = context.players || []
    this.allKnownPlayers = context.allKnownPlayers || []
    this.teamSquads = context.teamSquads || []
    this.tournaments = context.tournaments || []
    this.tournamentPlayers = context.tournamentPlayers || []
    if (!this.tournamentPlayers.length && this.teamSquads.length) {
      for (const squad of this.teamSquads) {
        const tournamentId =
          this.tournaments.find((item) => item.name === squad.tournament)?.id || null
        if (!tournamentId) continue
        for (const entry of Array.isArray(squad.squad) ? squad.squad : []) {
          const matched = this.allKnownPlayers.find(
            (player) =>
              (player.name || '').toString().trim().toLowerCase() ===
              (entry.name || '').toString().trim().toLowerCase(),
          )
          if (!matched) continue
          this.tournamentPlayers.push({
            tournamentId,
            playerId: matched.id,
            teamCode: squad.teamCode,
            role: entry.role || matched.role || '',
            active: entry.active !== false,
          })
        }
      }
    }
  }

  async findAll() {
    return this.allKnownPlayers.map((p) => this._toDto(p))
  }

  async findByTournament(tournamentId) {
    const links = this.tournamentPlayers.filter(
      (row) => String(row.tournamentId) === String(tournamentId),
    )
    return links
      .map((row) => {
        const player = this.allKnownPlayers.find((item) => item.id === row.playerId)
        if (!player) return null
        return this._toDto({
          ...player,
          role: row.role || player.role,
          teamKey: row.teamCode,
          team: row.teamCode,
          active: row.active !== false,
        })
      })
      .filter(Boolean)
  }

  async findById(id) {
    const p = this.allKnownPlayers.find((item) => item.id === id)
    if (!p) return null
    return this._toDto(p)
  }

  async findByTeam(teamKey, tournamentId = null) {
    if (tournamentId) {
      return (await this.findByTournament(tournamentId)).filter(
        (p) => (p.teamKey || p.team) === teamKey,
      )
    }
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
    const id =
      data.canonicalPlayerId ||
      data.id ||
      data.playerId ||
      `p${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const displayName =
      data.displayName || [data.firstName, data.lastName].filter(Boolean).join(' ').trim()
    const player = {
      id,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName,
      name: displayName,
      role: data.role,
      team: data.team,
      teamKey: data.teamKey,
      playerId: data.playerId,
      sourceKey: data.sourceKey || '',
      country: data.country || '',
      imageUrl: data.imageUrl || '',
      battingStyle: data.battingStyle || '',
      bowlingStyle: data.bowlingStyle || '',
      active: data.active !== false,
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

  async findCanonical(data) {
    const explicitId = (data.canonicalPlayerId || data.id || '').toString().trim()
    if (explicitId) {
      const byId = this.allKnownPlayers.find((item) => String(item.id) === explicitId)
      if (byId) return byId
    }
    const normalizedName = (
      data.displayName ||
      [data.firstName, data.lastName].filter(Boolean).join(' ')
    )
      .toString()
      .trim()
      .toLowerCase()
    const normalizedCountry = (data.country || '').toString().trim().toLowerCase()
    const exact = this.allKnownPlayers.find((item) => {
      const itemName = (
        item.displayName ||
        item.name ||
        [item.firstName, item.lastName].filter(Boolean).join(' ')
      )
        .toString()
        .trim()
        .toLowerCase()
      const itemCountry = (item.country || item.nationality || '').toString().trim().toLowerCase()
      return itemName === normalizedName && itemCountry === normalizedCountry
    })
    if (exact) return exact

    return (
      this.allKnownPlayers.find((item) => {
        const itemName = (
          item.displayName ||
          item.name ||
          [item.firstName, item.lastName].filter(Boolean).join(' ')
        )
          .toString()
          .trim()
          .toLowerCase()
        return itemName === normalizedName
      }) || null
    )
  }

  async findByDisplayNameAndCountry(displayName, country) {
    const normalizedName = (displayName || '').toString().trim().toLowerCase()
    const normalizedCountry = (country || '').toString().trim().toLowerCase()
    return (
      this.allKnownPlayers.find((item) => {
        const itemName = (
          item.displayName ||
          item.name ||
          [item.firstName, item.lastName].filter(Boolean).join(' ')
        )
          .toString()
          .trim()
          .toLowerCase()
        const itemCountry = (item.country || item.nationality || '').toString().trim().toLowerCase()
        return itemName === normalizedName && itemCountry === normalizedCountry
      }) || null
    )
  }

  async upsertCanonical(data) {
    const existing = await this.findCanonical(data)
    if (existing) {
      Object.assign(existing, {
        role: data.role || existing.role,
        team: data.team || data.teamKey || existing.team,
        teamKey: data.teamKey || data.team || existing.teamKey,
        displayName: data.displayName || existing.displayName || existing.name,
        name: data.displayName || existing.displayName || existing.name,
        country: data.country ?? existing.country ?? '',
        imageUrl: data.imageUrl ?? existing.imageUrl ?? '',
        active: data.active !== false,
      })
      return this._toDto(existing)
    }
    return this.create(data)
  }

  async bulkCreate(players) {
    const created = []
    for (const player of players) {
      created.push(await this.upsertCanonical(player))
    }
    return created
  }

  async bulkCreateLegacy(players) {
    return this.bulkCreate(players)
  }

  async replaceTournamentTeamPlayers({ tournamentId, teamKey, players = [] }) {
    const retained = this.tournamentPlayers.filter(
      (row) => !(String(row.tournamentId) === String(tournamentId) && row.teamCode === teamKey),
    )
    this.tournamentPlayers.length = 0
    this.tournamentPlayers.push(...retained)
    this.context.tournamentPlayers = this.tournamentPlayers
    const created = []
    for (const player of players) {
      const canonical = await this.upsertCanonical(player)
      this.tournamentPlayers.push({
        tournamentId,
        playerId: canonical.id,
        teamCode: teamKey,
        role: player.role || canonical.role || '',
        active: player.active !== false,
      })
      created.push(canonical)
    }
    return created
  }

  async findAllTeamSquads(tournamentId = null) {
    const byTeam = new Map()
    const links = tournamentId
      ? this.tournamentPlayers.filter((row) => String(row.tournamentId) === String(tournamentId))
      : this.tournamentPlayers
    for (const row of links) {
      const player = this.allKnownPlayers.find((item) => item.id === row.playerId)
      if (!player) continue
      const squadMeta =
        this.teamSquads.find(
          (item) =>
            item.teamCode === row.teamCode &&
            (!tournamentId || item.tournamentId === tournamentId || item.tournament === this.tournaments.find((t) => String(t.id) === String(tournamentId))?.name),
        ) || null
      const teamCode = row.teamCode || player.teamKey || player.team || ''
      const key = `${row.tournamentId || 'none'}::${teamCode}`
      if (!teamCode) continue
      if (!byTeam.has(key)) {
        byTeam.set(key, {
          tournamentId: row.tournamentId || null,
          teamCode,
          teamName: squadMeta?.teamName || player.teamName || teamCode,
          tournamentType: squadMeta?.tournamentType || 'league',
          country: squadMeta?.country || player.country || '',
          league: squadMeta?.league || player.league || '',
          tournament: squadMeta?.tournament || player.tournament || '',
          source: 'mock',
          lastUpdatedAt: player.updatedAt || player.createdAt || null,
          squad: [],
        })
      }
      byTeam.get(key).squad.push({
        id: player.id,
        canonicalPlayerId: player.id,
        name:
          player.displayName ||
          player.name ||
          [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
        country: player.country || '',
        role: row.role || player.role,
        playerId: player.playerId,
        sourceKey: player.sourceKey || '',
        imageUrl: player.imageUrl || '',
        battingStyle: player.battingStyle || '',
        bowlingStyle: player.bowlingStyle || '',
        active: row.active !== false,
      })
    }
    if (!tournamentId) {
      for (const squadMeta of this.teamSquads) {
        if (squadMeta?.tournamentId) continue
        const teamCode = squadMeta.teamCode || ''
        if (!teamCode) continue
        const key = `none::${teamCode}`
        if (!byTeam.has(key)) {
          byTeam.set(key, {
            tournamentId: null,
            teamCode,
            teamName: squadMeta.teamName || teamCode,
            tournamentType: squadMeta.tournamentType || 'league',
            country: squadMeta.country || '',
            league: squadMeta.league || '',
            tournament: squadMeta.tournament || '',
            source: squadMeta.source || 'mock',
            lastUpdatedAt: squadMeta.updatedAt || null,
            squad: [],
          })
        }
        const rows = this.allKnownPlayers.filter(
          (player) => (player.teamKey || player.team || '') === teamCode,
        )
        for (const player of rows) {
          byTeam.get(key).squad.push({
            id: player.id,
            canonicalPlayerId: player.id,
            name:
              player.displayName ||
              player.name ||
              [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
            country: player.country || '',
            role: player.role || '',
            playerId: player.playerId,
            sourceKey: player.sourceKey || '',
            imageUrl: player.imageUrl || '',
            battingStyle: player.battingStyle || '',
            bowlingStyle: player.bowlingStyle || '',
            active: player.active !== false,
          })
        }
      }
    }
    return [...byTeam.values()].sort((a, b) => a.teamCode.localeCompare(b.teamCode))
  }

  async upsertTeamSquadMeta(data = {}) {
    const teamCode = (data.teamCode || '').toString().trim().toUpperCase()
    const tournamentId = data.tournamentId ?? null
    const existingIndex = this.teamSquads.findIndex(
      (row) =>
        row.teamCode === teamCode &&
        String(row.tournamentId || '') === String(tournamentId || ''),
    )
    const nextRow = {
      tournamentId,
      teamCode,
      teamName: data.teamName || teamCode,
      tournamentType: data.tournamentType || 'league',
      country: data.country || '',
      league: data.league || '',
      tournament: data.tournament || '',
      source: data.source || 'manual',
      updatedAt: new Date().toISOString(),
    }
    if (existingIndex === -1) {
      this.teamSquads.push(nextRow)
    } else {
      this.teamSquads.splice(existingIndex, 1, nextRow)
    }
    return { ok: true, ...nextRow }
  }

  async deleteByTeam(teamKey, tournamentId = null) {
    if (tournamentId) {
      const retained = this.tournamentPlayers.filter(
        (row) => !(String(row.tournamentId) === String(tournamentId) && row.teamCode === teamKey),
      )
      this.tournamentPlayers.length = 0
      this.tournamentPlayers.push(...retained)
      this.context.tournamentPlayers = this.tournamentPlayers
      return true
    }
    const remaining = this.allKnownPlayers.filter(
      (item) => (item.teamKey || item.team) !== teamKey,
    )
    this.allKnownPlayers.length = 0
    this.allKnownPlayers.push(...remaining)
    return true
  }

  async deleteTeamSquadMeta(teamKey, tournamentId = null) {
    if (tournamentId) {
      const retained = this.teamSquads.filter(
        (row) => !(row.teamCode === teamKey && String(row.tournamentId || '') === String(tournamentId)),
      )
      this.teamSquads.length = 0
      this.teamSquads.push(...retained)
      this.context.teamSquads = this.teamSquads
      return true
    }
    return true
  }

  async delete(id) {
    const index = this.players.findIndex((item) => item.id === id)
    const [deleted] =
      index === -1 ? [this.allKnownPlayers.find((item) => item.id === id)] : this.players.splice(index, 1)
    if (!deleted) return null
    const catIndex = this.allKnownPlayers.findIndex((p) => p.id === id)
    if (catIndex !== -1) {
      this.allKnownPlayers.splice(catIndex, 1)
    }
    const retainedTournamentPlayers = this.tournamentPlayers.filter((row) => row.playerId !== id)
    this.tournamentPlayers.length = 0
    this.tournamentPlayers.push(...retainedTournamentPlayers)
    this.context.tournamentPlayers = this.tournamentPlayers

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
      displayName: player.displayName || player.name || '',
      country: player.country || '',
      imageUrl: player.imageUrl || '',
      active: player.active !== false,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
    }
  }
}

export { PlayerMockRepository }
