import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import { mapMatchWithDerivedStatus } from './tournamentImport.service.js'

const factory = createRepositoryFactory()

class PlayerService {
  async resolveTournamentIdFromPayload(payload = {}) {
    const explicitTournamentId = payload?.tournamentId
    if (explicitTournamentId != null && `${explicitTournamentId}`.trim()) {
      const rawValue = `${explicitTournamentId}`.trim()
      const asNumber = Number(rawValue)
      return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : rawValue
    }
    const tournamentName = (payload?.tournament || '').toString().trim()
    if (!tournamentName) return null
    const result = await dbQuery(
      `SELECT id
       FROM tournaments
       WHERE lower(trim(name)) = lower(trim($1))
       ORDER BY id DESC
       LIMIT 1`,
      [tournamentName],
    )
    return Number(result.rows[0]?.id || 0) || null
  }

  normalizeLineupName(value = '') {
    return value.toString().trim()
  }

  dedupeLineupNames(values = []) {
    return Array.from(
      new Set(
        (Array.isArray(values) ? values : [])
          .map((item) => this.normalizeLineupName(item))
          .filter(Boolean),
      ),
    )
  }

  validateLineupTeamPayload({ teamCode, payload, fallbackSquad = [] }) {
    if (!payload || typeof payload !== 'object') {
      throw new Error(`lineups.${teamCode} is required`)
    }

    const providedSquad = Array.isArray(payload.squad) ? payload.squad : []
    const normalizedSquad = this.dedupeLineupNames(
      providedSquad.length ? providedSquad : fallbackSquad,
    )
    const playingXI = this.dedupeLineupNames(payload.playingXI)
    const bench = this.dedupeLineupNames(payload.bench)

    if (normalizedSquad.length < 11) {
      throw new Error(`lineups.${teamCode}.squad must contain at least 11 unique players`)
    }
    if (playingXI.length < 11 || playingXI.length > 12) {
      throw new Error(`lineups.${teamCode}.playingXI must contain 11 or 12 unique players`)
    }

    const squadSet = new Set(normalizedSquad)
    const xiOutside = playingXI.find((name) => !squadSet.has(name))
    if (xiOutside) {
      throw new Error(`lineups.${teamCode}.playingXI player "${xiOutside}" is not in squad`)
    }

    const captain = this.normalizeLineupName(payload.captain || '')
    const viceCaptain = this.normalizeLineupName(payload.viceCaptain || '')
    if (captain && !playingXI.includes(captain)) {
      throw new Error(`lineups.${teamCode}.captain must be part of playingXI`)
    }
    if (viceCaptain && !playingXI.includes(viceCaptain)) {
      throw new Error(`lineups.${teamCode}.viceCaptain must be part of playingXI`)
    }
    if (captain && viceCaptain && captain === viceCaptain) {
      throw new Error(`lineups.${teamCode}.captain and viceCaptain cannot be the same`)
    }

    return {
      squad: normalizedSquad,
      playingXI,
      bench: bench.filter((name) => !playingXI.includes(name)),
      captain: captain || null,
      viceCaptain: viceCaptain || null,
    }
  }

  async getMatchLineupMap(tournamentId, matchId) {
    if (!tournamentId || !matchId) return new Map()
    const result = await dbQuery(
      `SELECT team_code as "teamCode",
              squad,
              playing_xi as "playingXI",
              bench,
              captain,
              vice_captain as "viceCaptain",
              source,
              updated_by as "updatedBy",
              meta,
              updated_at as "updatedAt"
       FROM match_lineups
       WHERE tournament_id = $1 AND match_id = $2`,
      [tournamentId, matchId],
    )
    return new Map(
      result.rows.map((row) => [
        row.teamCode,
        {
          teamCode: row.teamCode,
          squad: typeof row.squad === 'string' ? JSON.parse(row.squad) : row.squad || [],
          playingXI:
            typeof row.playingXI === 'string' ? JSON.parse(row.playingXI) : row.playingXI || [],
          bench: typeof row.bench === 'string' ? JSON.parse(row.bench) : row.bench || [],
          captain: row.captain || null,
          viceCaptain: row.viceCaptain || null,
          source: row.source || 'manual-xi',
          updatedBy: row.updatedBy || 'admin',
          meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta || {},
          updatedAt: row.updatedAt || null,
        },
      ]),
    )
  }

  async getAllPlayers() {
    const repo = await factory.getPlayerRepository()
    return await repo.findAll()
  }

  async createPlayer(payload = {}) {
    const repo = await factory.getPlayerRepository()
    const fullName = (payload.name || payload.displayName || '').toString().trim()
    if (!fullName) throw new Error('Player name is required')
    const firstName =
      payload.firstName ||
      payload.first_name ||
      fullName.split(/\s+/).slice(0, -1).join(' ') ||
      fullName
    const lastName =
      payload.lastName ||
      payload.last_name ||
      fullName.split(/\s+/).slice(-1).join(' ') ||
      ''
    return await repo.upsertCanonical({
      canonicalPlayerId: payload.canonicalPlayerId || payload.id || null,
      firstName,
      lastName,
      displayName: fullName,
      role: (payload.role || '').toString().trim().toUpperCase(),
      country: (payload.country || '').toString().trim(),
      imageUrl: (payload.imageUrl || '').toString().trim(),
      battingStyle: (payload.battingStyle || '').toString().trim(),
      bowlingStyle: (payload.bowlingStyle || '').toString().trim(),
      active: payload.active !== false,
      sourceKey:
        payload.sourceKey ||
        payload.source_key ||
        payload.playerId ||
        payload.player_id ||
        null,
      playerId: payload.playerId || payload.player_id || null,
    })
  }

  async deletePlayer(id) {
    const repo = await factory.getPlayerRepository()
    if (!id && id !== 0) throw new Error('Player id is required')
    const deleted = await repo.delete(id)
    if (!deleted) throw new Error('Player not found')
    return { deleted: true }
  }

  async getPlayersByTeam(teamKey) {
    const repo = await factory.getPlayerRepository()
    return await repo.findByTeam(teamKey)
  }

  async getPlayerStats(playerId) {
    const repo = await factory.getPlayerRepository()
    return await repo.findStats(playerId)
  }

  async getTournamentPlayerStats(tournamentId) {
    if (!tournamentId) return []

    const matchRepo = await factory.getMatchRepository()
    const playerRepo = await factory.getPlayerRepository()
    const matches = await matchRepo.findByTournament(tournamentId)
    const teamKeys = [...new Set(
      (matches || [])
        .flatMap((match) => [match.teamAKey || match.teamA, match.teamBKey || match.teamB])
        .filter(Boolean),
    )]
    if (!teamKeys.length) return []

    const playerGroups = await Promise.all(
      teamKeys.map((teamKey) => playerRepo.findByTeam(teamKey, tournamentId)),
    )
    const playerRows = playerGroups.flat().map((player) => ({
      ...player,
      name:
        player.displayName ||
        [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
      team: player.teamKey,
    }))

    const teamMetaRows =
      typeof playerRepo.findAllTeamSquads === 'function'
        ? await playerRepo.findAllTeamSquads(tournamentId)
        : []
    const teamMetaByCode = new Map(
      (teamMetaRows || []).map((row) => [
        row.teamCode,
        {
          teamName: row.teamName || row.teamCode,
          country: row.country || '',
          league: row.league || '',
        },
      ]),
    )

    const scoreResult = await dbQuery(
      `SELECT player_id as "playerId", runs, wickets, catches, fours, sixes, fantasy_points as "fantasyPoints"
       FROM player_match_scores
       WHERE tournament_id = $1`,
      [tournamentId],
    )

    const aggregateByPlayerId = {}
    scoreResult.rows.forEach((row) => {
      const key = row.playerId
      if (!aggregateByPlayerId[key]) {
        aggregateByPlayerId[key] = {
          runs: 0,
          wickets: 0,
          catches: 0,
          fours: 0,
          sixes: 0,
          points: 0,
        }
      }
      aggregateByPlayerId[key].runs += Number(row.runs || 0)
      aggregateByPlayerId[key].wickets += Number(row.wickets || 0)
      aggregateByPlayerId[key].catches += Number(row.catches || 0)
      aggregateByPlayerId[key].fours += Number(row.fours || 0)
      aggregateByPlayerId[key].sixes += Number(row.sixes || 0)
      aggregateByPlayerId[key].points += Number(row.fantasyPoints || 0)
    })

    return playerRows
      .map((player) => {
        const meta = teamMetaByCode.get(player.teamKey) || null
        const aggregate = aggregateByPlayerId[player.id] || null
        return {
          id: player.id,
          name: player.name,
          team: player.teamKey,
          teamCode: player.teamKey,
          teamName: meta?.teamName || player.teamName || player.teamKey,
          country: meta?.country || player.country || '',
          league: meta?.league || '',
          role: player.role,
          imageUrl: player.imageUrl || '',
          runs: Number(aggregate?.runs || 0),
          wickets: Number(aggregate?.wickets || 0),
          catches: Number(aggregate?.catches || 0),
          fours: Number(aggregate?.fours || 0),
          sixes: Number(aggregate?.sixes || 0),
          points: Number(aggregate?.points || 0),
        }
      })
      .sort((a, b) => Number(b.points || 0) - Number(a.points || 0))
  }

  async getTeamPool({ contestId, tournamentId, matchId, userId }) {
    const contestRepo = await factory.getContestRepository()
    const matchRepo = await factory.getMatchRepository()
    const playerRepo = await factory.getPlayerRepository()
    const teamSelectionRepo = await factory.getTeamSelectionRepository()

    const contest = contestId ? await contestRepo.findById(contestId) : null
    const resolvedTournamentId = contest?.tournamentId || tournamentId || ''
    if (!resolvedTournamentId) {
      throw new Error('contestId or tournamentId is required')
    }

    const tournamentMatches = await matchRepo.findByTournament(resolvedTournamentId)
    const contestMatchIds = Array.isArray(contest?.matchIds) ? contest.matchIds : []
    const availableMatches = contest
      ? tournamentMatches.filter((item) => contestMatchIds.includes(item.id))
      : tournamentMatches
    const activeMatchRaw =
      availableMatches.find((item) => String(item.id) === String(matchId)) ||
      availableMatches[0] ||
      null
    const activeMatch = activeMatchRaw ? mapMatchWithDerivedStatus(activeMatchRaw) : null

    if (!activeMatch) {
      return {
        contest: contest || null,
        activeMatch: null,
        selection: null,
        teams: {
          teamA: { name: '', players: [], lineup: null },
          teamB: { name: '', players: [], lineup: null },
        },
      }
    }

    const teamAKey = activeMatch.teamAKey || activeMatch.teamA
    const teamBKey = activeMatch.teamBKey || activeMatch.teamB
    const [teamAPlayersRaw, teamBPlayersRaw] = await Promise.all([
      playerRepo.findByTeam(teamAKey, resolvedTournamentId),
      playerRepo.findByTeam(teamBKey, resolvedTournamentId),
    ])

    const normalizePoolPlayer = (player) => ({
      id: player.id,
      playerId: player.playerId || player.id,
      name:
        player.displayName ||
        [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
      role: player.role,
      team: player.teamKey,
      country: player.country || '',
      imageUrl: player.imageUrl || '',
      battingStyle: player.battingStyle || '',
      bowlingStyle: player.bowlingStyle || '',
      active: player.active !== false,
    })

    const lineupMap = await this.getMatchLineupMap(resolvedTournamentId, activeMatch.id)

    const selection =
      userId && activeMatch?.id
        ? await teamSelectionRepo.findByMatchAndUser(activeMatch.id, userId, contest?.id || null)
        : null

    return {
      contest: contest || null,
      activeMatch: {
        id: activeMatch.id,
        tournamentId: activeMatch.tournamentId,
        name: activeMatch.name,
        home: activeMatch.teamAKey || activeMatch.teamA,
        away: activeMatch.teamBKey || activeMatch.teamB,
        teamA: activeMatch.teamA,
        teamB: activeMatch.teamB,
        teamAKey: activeMatch.teamAKey,
        teamBKey: activeMatch.teamBKey,
        startAt: activeMatch.startTime,
        status: activeMatch.status,
      },
      selection: selection || null,
      teams: {
        teamA: {
          name: teamAKey,
          players: (teamAPlayersRaw || []).map(normalizePoolPlayer),
          lineup: lineupMap.get(teamAKey) || null,
        },
        teamB: {
          name: teamBKey,
          players: (teamBPlayersRaw || []).map(normalizePoolPlayer),
          lineup: lineupMap.get(teamBKey) || null,
        },
      },
    }
  }

  async getTeamSquads(tournamentId) {
    const repo = await factory.getPlayerRepository()
    if (typeof repo.findAllTeamSquads === 'function') {
      const rows = await repo.findAllTeamSquads(tournamentId || null)
      if (Array.isArray(rows)) return rows
    }
    const allPlayers = await repo.findAll()
    const teamKeys = [...new Set(allPlayers.map((p) => p.teamKey).filter(Boolean))]
    const squads = []
    for (const teamKey of teamKeys) {
      const players = await repo.findByTeam(teamKey, tournamentId || null)
      squads.push({
        teamCode: teamKey,
        teamName: players[0]?.teamName || teamKey,
        tournamentType: 'league',
        country: players[0]?.country || '',
        league: '',
        tournament: '',
        source: 'derived',
        lastUpdatedAt: players[0]?.updatedAt || null,
        squad: players.map((player) => ({
          id: player.id,
          name:
            player.displayName ||
            [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
          country: player.country || '',
          role: player.role,
          playerId: player.playerId,
          imageUrl: player.imageUrl || '',
          battingStyle: player.battingStyle || '',
          bowlingStyle: player.bowlingStyle || '',
          active: player.active !== false,
        })),
      })
    }
    return squads
  }

  async createTeamSquad(teamKey, payload) {
    const repo = await factory.getPlayerRepository()
    const normalizedPlayers = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.players)
        ? payload.players
        : []
    const teamMeta = Array.isArray(payload) ? {} : payload || {}
    const resolvedTournamentId = await this.resolveTournamentIdFromPayload(teamMeta)

    if (typeof repo.upsertTeamSquadMeta === 'function') {
      await repo.upsertTeamSquadMeta({
        tournamentId: resolvedTournamentId,
        teamCode: teamKey,
        teamName: teamMeta.teamName || teamKey,
        tournamentType: teamMeta.tournamentType || 'league',
        country: teamMeta.country || '',
        league: teamMeta.league || '',
        tournament: teamMeta.tournament || '',
        source: teamMeta.source || 'manual',
      })
    }

    const data = normalizedPlayers.map((p) => {
      const fullName = (p.name || p.displayName || '').toString().trim()
      const firstName = p.firstName || p.first_name || fullName.split(/\s+/).slice(0, -1).join(' ') || fullName
      const lastName = p.lastName || p.last_name || fullName.split(/\s+/).slice(-1).join(' ') || ''
      return {
        canonicalPlayerId: p.canonicalPlayerId || p.playerRowId || p.id || p.playerId || '',
        firstName,
        lastName,
        displayName: fullName || [firstName, lastName].filter(Boolean).join(' ').trim(),
        role: p.role,
        teamKey,
        teamName: teamMeta.teamName || p.teamName || teamKey,
        playerId: p.playerId || p.player_id,
        country: p.country || teamMeta.country || '',
        imageUrl: p.imageUrl || p.player_img || '',
        battingStyle: p.battingStyle || p.batting_style || '',
        bowlingStyle: p.bowlingStyle || p.bowling_style || '',
        active: p.active !== false,
        basePrice: p.basePrice ?? p.base_price ?? null,
        sourceKey:
          p.sourceKey ||
          p.source_key ||
          p.canonicalPlayerId ||
          p.id ||
          p.playerId ||
          p.player_id ||
          null,
      }
    })
    if (resolvedTournamentId && typeof repo.replaceTournamentTeamPlayers === 'function') {
      return await repo.replaceTournamentTeamPlayers({
        tournamentId: resolvedTournamentId,
        teamKey,
        teamName: teamMeta.teamName || teamKey,
        players: data,
      })
    }

    if (typeof repo.deleteByTeam === 'function') {
      await repo.deleteByTeam(teamKey)
    }
    return await repo.bulkCreateLegacy(data)
  }

  async deleteTeamSquad(teamKey, tournamentId = null) {
    const repo = await factory.getPlayerRepository()
    if (typeof repo.deleteByTeam === 'function') {
      await repo.deleteByTeam(teamKey, tournamentId || null)
    } else {
      const players = await repo.findByTeam(teamKey, tournamentId || null)
      for (const player of players) {
        await repo.delete(player.id)
      }
    }
    if (typeof repo.deleteTeamSquadMeta === 'function') {
      await repo.deleteTeamSquadMeta(teamKey, tournamentId || null)
    }
    return { deleted: true }
  }

  async getTournamentMatchLineups(tournamentId, matchId) {
    const matchRepo = await factory.getMatchRepository()
    const match = await matchRepo.findById(matchId)
    if (!match || String(match.tournamentId) !== String(tournamentId)) {
      return null
    }
    const saved = Object.fromEntries(await this.getMatchLineupMap(tournamentId, matchId))
    return {
      tournamentId,
      matchId,
      match,
      saved: saved && Object.keys(saved).length
        ? {
            tournamentId,
            matchId,
            lineups: saved,
          }
        : null,
    }
  }

  async upsertMatchLineups(tournamentId, matchId, lineups, meta = {}) {
    const matchRepo = await factory.getMatchRepository()
    const match = await matchRepo.findById(matchId)
    if (!match || String(match.tournamentId) !== String(tournamentId)) {
      throw new Error('Match not found')
    }
    const teamCodes = [match.teamAKey || match.teamA, match.teamBKey || match.teamB].filter(Boolean)
    const extraTeams = Object.keys(lineups || {}).filter((teamCode) => !teamCodes.includes(teamCode))
    if (extraTeams.length) {
      throw new Error(`lineups contains invalid team keys: ${extraTeams.join(', ')}`)
    }
    const missingTeams = teamCodes.filter((teamCode) => !(lineups || {})[teamCode])
    if (missingTeams.length) {
      throw new Error(`lineups missing required team keys: ${missingTeams.join(', ')}`)
    }

    const repo = await factory.getPlayerRepository()
    const [teamAPlayers, teamBPlayers] = await Promise.all([
      repo.findByTeam(match.teamAKey || match.teamA, tournamentId),
      repo.findByTeam(match.teamBKey || match.teamB, tournamentId),
    ])
    const fallbackByTeam = {
      [match.teamAKey || match.teamA]: (teamAPlayers || [])
        .map((player) => player.displayName || [player.firstName, player.lastName].filter(Boolean).join(' ').trim())
        .filter(Boolean),
      [match.teamBKey || match.teamB]: (teamBPlayers || [])
        .map((player) => player.displayName || [player.firstName, player.lastName].filter(Boolean).join(' ').trim())
        .filter(Boolean),
    }

    const normalizedLineups = {}
    for (const teamCode of teamCodes) {
      normalizedLineups[teamCode] = this.validateLineupTeamPayload({
        teamCode,
        payload: lineups[teamCode],
        fallbackSquad: fallbackByTeam[teamCode],
      })
      await dbQuery(
        `INSERT INTO match_lineups (
           tournament_id, match_id, team_code, squad, playing_xi, bench,
           captain, vice_captain, source, updated_by, meta, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11::jsonb, now(), now())
         ON CONFLICT (tournament_id, match_id, team_code) DO UPDATE
         SET squad = excluded.squad,
             playing_xi = excluded.playing_xi,
             bench = excluded.bench,
             captain = excluded.captain,
             vice_captain = excluded.vice_captain,
             source = excluded.source,
             updated_by = excluded.updated_by,
             meta = excluded.meta,
             updated_at = now()`,
        [
          tournamentId,
          matchId,
          teamCode,
          JSON.stringify(normalizedLineups[teamCode].squad),
          JSON.stringify(normalizedLineups[teamCode].playingXI),
          JSON.stringify(normalizedLineups[teamCode].bench),
          normalizedLineups[teamCode].captain,
          normalizedLineups[teamCode].viceCaptain,
          (meta?.source || 'manual-xi').toString(),
          (meta?.updatedBy || 'admin').toString(),
          JSON.stringify(meta?.meta || {}),
        ],
      )
    }

    return {
      ok: true,
      saved: {
        tournamentId,
        matchId,
        lineups: normalizedLineups,
        source: (meta?.source || 'manual-xi').toString(),
        updatedBy: (meta?.updatedBy || 'admin').toString(),
        updatedAt: new Date().toISOString(),
        meta: meta?.meta && typeof meta.meta === 'object' ? meta.meta : {},
      },
    }
  }
}

export default new PlayerService()
