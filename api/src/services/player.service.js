import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import { mapMatchWithDerivedStatus } from './tournamentImport.service.js'

const factory = createRepositoryFactory()

class PlayerService {
  normalizeImportedRole(value = '') {
    return value.toString().trim().toUpperCase()
  }

  normalizeImportedCountry(payload = {}) {
    return (payload.country || payload.nationality || '').toString().trim()
  }

  validatePlayerPayload(payload = {}, { label = 'player' } = {}) {
    const fullName = (payload.name || payload.displayName || '').toString().trim()
    if (!fullName) throw new Error(`${label} name is required`)
    const country = this.normalizeImportedCountry(payload)
    if (!country) throw new Error(`${label} country/nationality is required`)
    const role = this.normalizeImportedRole(payload.role || '')
    if (!role) throw new Error(`${label} role is required`)
    return {
      fullName,
      country,
      role,
    }
  }

  async ensureNoDuplicateCatalogPlayer(payload = {}) {
    const repo = await factory.getPlayerRepository()
    const { fullName, country } = this.validatePlayerPayload(payload, {
      label: 'Player',
    })
    const duplicate =
      typeof repo.findByDisplayNameAndCountry === 'function'
        ? await repo.findByDisplayNameAndCountry(fullName, country)
        : null
    if (!duplicate) return

    const incomingKeys = [
      payload.canonicalPlayerId,
      payload.id,
      payload.playerId,
      payload.player_id,
      payload.sourceKey,
      payload.source_key,
    ]
      .map((value) => (value == null ? '' : `${value}`.trim()))
      .filter(Boolean)
    const duplicateKeys = [duplicate.id, duplicate.playerId, duplicate.sourceKey]
      .map((value) => (value == null ? '' : `${value}`.trim()))
      .filter(Boolean)

    if (
      !incomingKeys.length ||
      !incomingKeys.some((key) => duplicateKeys.includes(key))
    ) {
      throw new Error(`Player already exists: ${fullName} (${country})`)
    }
  }

  async resolveTournamentIdFromPayload(payload = {}) {
    const tournamentRepo = await factory.getTournamentRepository()
    const explicitTournamentId = payload?.tournamentId
    if (explicitTournamentId != null && `${explicitTournamentId}`.trim()) {
      const rawValue = `${explicitTournamentId}`.trim()
      if (/^\d+$/.test(rawValue)) {
        return Number(rawValue)
      }
      if (typeof tournamentRepo?.findBySourceKey === 'function') {
        const bySourceKey = await tournamentRepo.findBySourceKey(rawValue)
        if (bySourceKey?.id != null) return Number(bySourceKey.id)
      }
    }
    const tournamentName = (payload?.tournament || '').toString().trim()
    if (!tournamentName) return null
    if (typeof tournamentRepo?.findAll === 'function') {
      const tournaments = await tournamentRepo.findAll()
      const byName = (tournaments || []).find(
        (item) =>
          `${item?.name || ''}`.trim().toLowerCase() === tournamentName.toLowerCase(),
      )
      if (byName?.id != null) return Number(byName.id)
    }
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
      throw new Error(
        `lineups.${teamCode}.playingXI must contain 11 or 12 unique players`,
      )
    }

    const squadSet = new Set(normalizedSquad)
    const xiOutside = playingXI.find((name) => !squadSet.has(name))
    if (xiOutside) {
      throw new Error(
        `lineups.${teamCode}.playingXI player "${xiOutside}" is not in squad`,
      )
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
            typeof row.playingXI === 'string'
              ? JSON.parse(row.playingXI)
              : row.playingXI || [],
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
    const { fullName, country, role } = this.validatePlayerPayload(payload, {
      label: 'Player',
    })
    await this.ensureNoDuplicateCatalogPlayer(payload)
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
      role,
      country,
      imageUrl: (payload.imageUrl || payload.player_img || '').toString().trim(),
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

  async importPlayers(payload = {}) {
    const entries = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.players)
        ? payload.players
        : []
    if (!entries.length) throw new Error('players array is required')
    const seenPairs = new Set()
    entries.forEach((entry, index) => {
      const { fullName, country } = this.validatePlayerPayload(entry, {
        label: `players[${index}]`,
      })
      const key =
        `${fullName}`.trim().toLowerCase() + '::' + `${country}`.trim().toLowerCase()
      if (seenPairs.has(key)) {
        throw new Error(`Duplicate player in import payload: ${fullName} (${country})`)
      }
      seenPairs.add(key)
    })
    const imported = []
    for (const entry of entries) {
      imported.push(
        await this.createPlayer({
          ...entry,
          country: this.normalizeImportedCountry(entry),
          sourceKey:
            entry.sourceKey ||
            entry.source_key ||
            entry.canonicalPlayerId ||
            entry.id ||
            entry.playerId ||
            entry.player_id ||
            null,
          canonicalPlayerId:
            entry.canonicalPlayerId ||
            entry.id ||
            entry.playerId ||
            entry.player_id ||
            null,
          imageUrl: entry.imageUrl || entry.player_img || '',
        }),
      )
    }
    return {
      ok: true,
      importedCount: imported.length,
      players: imported,
    }
  }

  async deletePlayer(id) {
    const repo = await factory.getPlayerRepository()
    if (!id && id !== 0) throw new Error('Player id is required')
    const deleted = await repo.delete(id)
    if (!deleted) throw new Error('Player not found')
    return { deleted: true }
  }

  async deletePlayers(ids = []) {
    const repo = await factory.getPlayerRepository()
    const normalizedIds = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [])
          .map((value) => (value == null ? '' : String(value).trim()))
          .filter(Boolean),
      ),
    )
    if (!normalizedIds.length) throw new Error('At least one player id is required')
    const removedIds = []
    const missingIds = []
    for (const id of normalizedIds) {
      const deleted = await repo.delete(id)
      if (deleted) {
        removedIds.push(id)
      } else {
        missingIds.push(id)
      }
    }
    return {
      ok: true,
      removedIds,
      removedCount: removedIds.length,
      missingIds,
    }
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
    const teamKeys = [
      ...new Set(
        (matches || [])
          .flatMap((match) => [
            match.teamAKey || match.teamA,
            match.teamBKey || match.teamB,
          ])
          .filter(Boolean),
      ),
    ]
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
    const requestedMatch = matchId
      ? tournamentMatches.find((item) => String(item.id) === String(matchId))
      : null
    if (matchId && !requestedMatch) {
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
    const activeMatchRaw =
      requestedMatch || availableMatches[0] || tournamentMatches[0] || null
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
        ? await teamSelectionRepo.findByMatchAndUser(
            activeMatch.id,
            userId,
            contest?.id || null,
          )
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

  async getUserPicks({ userId, tournamentId, contestId, matchId }) {
    const contestRepo = await factory.getContestRepository()
    const playerRepo = await factory.getPlayerRepository()
    const teamSelectionRepo = await factory.getTeamSelectionRepository()
    const matchRepo = await factory.getMatchRepository()

    const contest = contestId ? await contestRepo.findById(contestId) : null
    const resolvedTournamentId = contest?.tournamentId || tournamentId || ''
    if (!resolvedTournamentId) {
      throw new Error('contestId or tournamentId is required')
    }

    const allPlayers =
      typeof playerRepo.findByTournament === 'function'
        ? await playerRepo.findByTournament(resolvedTournamentId)
        : await playerRepo.findAll()
    const playerById = new Map(
      (allPlayers || []).map((player) => [
        String(player.id),
        {
          id: player.id,
          name:
            player.displayName ||
            [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
          role: player.role || '-',
          team: player.teamKey || player.team || '-',
          imageUrl: player.imageUrl || '',
        },
      ]),
    )

    const pointsByPlayerId = new Map()
    if (matchId) {
      const matchPoints = await dbQuery(
        `SELECT player_id as "playerId", fantasy_points as "fantasyPoints"
         FROM player_match_scores
         WHERE tournament_id = $1 AND match_id = $2`,
        [resolvedTournamentId, matchId],
      )
      ;(matchPoints.rows || []).forEach((row) => {
        pointsByPlayerId.set(Number(row.playerId), Number(row.fantasyPoints || 0))
      })
    } else {
      const totalPoints = await dbQuery(
        `SELECT player_id as "playerId", COALESCE(SUM(fantasy_points), 0) as "fantasyPoints"
         FROM player_match_scores
         WHERE tournament_id = $1
         GROUP BY player_id`,
        [resolvedTournamentId],
      )
      ;(totalPoints.rows || []).forEach((row) => {
        pointsByPlayerId.set(Number(row.playerId), Number(row.fantasyPoints || 0))
      })
    }

    const isFixedRoster =
      (contest?.mode || '').toString().trim().toLowerCase() === 'fixed_roster'
    if (isFixedRoster) {
      const fixedRosterResult = await dbQuery(
        `SELECT player_ids as "playerIds"
         FROM contest_fixed_rosters
         WHERE contest_id = $1 AND user_id = $2
         LIMIT 1`,
        [contestId, userId],
      )
      const playerIds = Array.isArray(fixedRosterResult.rows[0]?.playerIds)
        ? fixedRosterResult.rows[0].playerIds
        : []
      const matchRecord =
        matchId && matchRepo.findById ? await matchRepo.findById(matchId) : null
      const activeTeamKeys = [
        matchRecord?.teamAKey || matchRecord?.teamA,
        matchRecord?.teamBKey || matchRecord?.teamB,
      ]
        .map((value) =>
          String(value || '')
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean)
      const activeTeamSet = new Set(activeTeamKeys)
      const rosterDetailed = playerIds
        .map((id) => playerById.get(String(id)))
        .filter(Boolean)
        .map((entry) => ({
          ...entry,
          points: Number(pointsByPlayerId.get(Number(entry.id)) || 0),
        }))
      const picksDetailed = activeTeamSet.size
        ? rosterDetailed.filter((entry) =>
            activeTeamSet.has(
              String(entry.team || '')
                .trim()
                .toUpperCase(),
            ),
          )
        : rosterDetailed.slice(0, 11)
      const backupsDetailed = activeTeamSet.size
        ? rosterDetailed.filter(
            (entry) =>
              !activeTeamSet.has(
                String(entry.team || '')
                  .trim()
                  .toUpperCase(),
              ),
          )
        : rosterDetailed.slice(11)
      return {
        userId,
        tournamentId: resolvedTournamentId,
        contestId,
        matchId,
        picks: picksDetailed.map((row) => row.name),
        backups: backupsDetailed.map((row) => row.name),
        picksDetailed,
        backupsDetailed,
      }
    }

    const selection =
      matchId && userId
        ? await teamSelectionRepo.findByMatchAndUser(matchId, userId, contest?.id || null)
        : null
    const picksDetailed = (selection?.playingXi || [])
      .map((id) => playerById.get(String(id)))
      .filter(Boolean)
      .map((entry) => ({
        ...entry,
        points: Number(pointsByPlayerId.get(Number(entry.id)) || 0),
      }))
    const backupsDetailed = (selection?.backups || [])
      .map((id) => playerById.get(String(id)))
      .filter(Boolean)
      .map((entry) => ({
        ...entry,
        points: Number(pointsByPlayerId.get(Number(entry.id)) || 0),
      }))
    return {
      userId,
      tournamentId: resolvedTournamentId,
      contestId,
      matchId,
      picks: picksDetailed.map((row) => row.name),
      backups: backupsDetailed.map((row) => row.name),
      picksDetailed,
      backupsDetailed,
    }
  }

  async getTeamSquads(tournamentId) {
    const repo = await factory.getPlayerRepository()
    const resolvedTournamentId =
      tournamentId == null
        ? null
        : await this.resolveTournamentIdFromPayload({
            tournamentId: `${tournamentId}`.trim(),
          })
    if (typeof repo.findAllTeamSquads === 'function') {
      const rows = await repo.findAllTeamSquads(resolvedTournamentId || null)
      if (Array.isArray(rows)) return rows
    }
    const allPlayers = await repo.findAll()
    const teamKeys = [...new Set(allPlayers.map((p) => p.teamKey).filter(Boolean))]
    const squads = []
    for (const teamKey of teamKeys) {
      const players = await repo.findByTeam(teamKey, resolvedTournamentId || null)
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
        : Array.isArray(payload?.squad)
          ? payload.squad
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

    const data = []
    for (const p of normalizedPlayers) {
      const canonicalRef =
        p.canonicalPlayerId || p.playerRowId || p.id || p.playerId || p.player_id || ''
      const existingCanonical =
        canonicalRef && typeof repo.findCanonical === 'function'
          ? await repo.findCanonical({ canonicalPlayerId: canonicalRef })
          : null
      if (canonicalRef && !existingCanonical && !(p.name || p.displayName)) {
        throw new Error(`Referenced player not found: ${canonicalRef}`)
      }
      const fullName = (p.name || p.displayName || '').toString().trim()
      const resolvedName =
        fullName ||
        existingCanonical?.displayName ||
        [existingCanonical?.firstName, existingCanonical?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim()
      const firstName =
        p.firstName ||
        p.first_name ||
        resolvedName.split(/\s+/).slice(0, -1).join(' ') ||
        resolvedName
      const lastName =
        p.lastName || p.last_name || resolvedName.split(/\s+/).slice(-1).join(' ') || ''
      data.push({
        canonicalPlayerId: canonicalRef,
        firstName,
        lastName,
        displayName:
          resolvedName || [firstName, lastName].filter(Boolean).join(' ').trim(),
        role: p.role || existingCanonical?.role || '',
        teamKey,
        teamName: teamMeta.teamName || p.teamName || teamKey,
        playerId:
          p.playerId || p.player_id || existingCanonical?.playerId || canonicalRef,
        country: p.country || existingCanonical?.country || teamMeta.country || '',
        imageUrl: p.imageUrl || p.player_img || existingCanonical?.imageUrl || '',
        battingStyle:
          p.battingStyle || p.batting_style || existingCanonical?.battingStyle || '',
        bowlingStyle:
          p.bowlingStyle || p.bowling_style || existingCanonical?.bowlingStyle || '',
        active: p.active !== false,
        basePrice: p.basePrice ?? p.base_price ?? null,
        sourceKey:
          p.sourceKey ||
          p.source_key ||
          canonicalRef ||
          existingCanonical?.sourceKey ||
          null,
      })
    }
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

  async importTeamSquadMappings(payload = {}) {
    const teamSquads = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.teamSquads)
        ? payload.teamSquads
        : []
    if (!teamSquads.length) throw new Error('teamSquads array is required')
    const baseTournamentId = await this.resolveTournamentIdFromPayload(payload)
    for (let index = 0; index < teamSquads.length; index += 1) {
      const row = teamSquads[index] || {}
      const teamCode = (row.teamCode || '').toString().trim().toUpperCase()
      if (!teamCode) throw new Error(`teamSquads[${index}].teamCode is required`)
      const resolvedTournamentId =
        (await this.resolveTournamentIdFromPayload({
          tournamentId: row.tournamentId || payload.tournamentId || '',
          tournament: row.tournament || payload.tournament || '',
        })) || baseTournamentId
      if (!resolvedTournamentId) {
        throw new Error(`teamSquads[${index}].tournamentId or tournament is required`)
      }
      const players = Array.isArray(row.players) ? row.players : row.squad
      if (!Array.isArray(players) || !players.length) {
        throw new Error(`teamSquads[${index}].squad must contain at least one player`)
      }
      players.forEach((player, playerIndex) => {
        const hasCanonicalRef = (player?.canonicalPlayerId || '').toString().trim()
        if (!hasCanonicalRef) {
          this.validatePlayerPayload(player, {
            label: `teamSquads[${index}].squad[${playerIndex}]`,
          })
        }
      })
    }
    const results = []
    for (const row of teamSquads) {
      const teamCode = (row.teamCode || '').toString().trim().toUpperCase()
      if (!teamCode) throw new Error('teamSquads[].teamCode is required')
      const created = await this.createTeamSquad(teamCode, {
        ...payload,
        ...row,
        tournamentType: 'tournament',
        tournamentId: row.tournamentId || payload.tournamentId || '',
        tournament: row.tournament || payload.tournament || '',
        country: row.country || payload.country || '',
        league: row.league || payload.league || '',
        teamCode,
        players: Array.isArray(row.players) ? row.players : row.squad,
      })
      results.push({
        teamCode,
        createdCount: Array.isArray(created) ? created.length : 0,
      })
    }
    return {
      ok: true,
      importedCount: results.length,
      teamSquads: results,
    }
  }

  async deleteTeamSquad(teamKey, tournamentId = null) {
    const repo = await factory.getPlayerRepository()
    const resolvedTournamentId =
      tournamentId == null
        ? null
        : await this.resolveTournamentIdFromPayload({
            tournamentId: `${tournamentId}`.trim(),
          })
    if (typeof repo.deleteByTeam === 'function') {
      await repo.deleteByTeam(teamKey, resolvedTournamentId || null)
    } else {
      const players = await repo.findByTeam(teamKey, resolvedTournamentId || null)
      for (const player of players) {
        await repo.delete(player.id)
      }
    }
    if (typeof repo.deleteTeamSquadMeta === 'function') {
      await repo.deleteTeamSquadMeta(teamKey, resolvedTournamentId || null)
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
      saved:
        saved && Object.keys(saved).length
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
    const teamCodes = [
      match.teamAKey || match.teamA,
      match.teamBKey || match.teamB,
    ].filter(Boolean)
    const extraTeams = Object.keys(lineups || {}).filter(
      (teamCode) => !teamCodes.includes(teamCode),
    )
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
        .map(
          (player) =>
            player.displayName ||
            [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
        )
        .filter(Boolean),
      [match.teamBKey || match.teamB]: (teamBPlayers || [])
        .map(
          (player) =>
            player.displayName ||
            [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
        )
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
