import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import { mapMatchWithDerivedStatus } from './tournamentImport.service.js'
import scoringRuleService from './scoring-rule.service.js'
import { cloneDefaultPointsRules } from '../default-points-rules.js'
import {
  calculateFantasyPointBreakdown,
  getRuleSetForTournament,
  resolveEffectiveSelection,
} from '../scoring.js'

const factory = createRepositoryFactory()

class PlayerService {
  // Normalizes imported role strings into canonical uppercase role values.
  normalizeImportedRole(value = '') {
    return value.toString().trim().toUpperCase()
  }

  // Extracts and normalizes player country/nationality from import payloads.
  normalizeImportedCountry(payload = {}) {
    return (payload.country || payload.nationality || '').toString().trim()
  }

  // Validates required player fields and returns normalized identity values.
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

  // Rejects duplicate catalog players unless source identifiers map to the same entity.
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

  // Resolves tournament id from payload identifiers or tournament name fallback.
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

  // Normalizes lineup player names for consistent dedupe and comparison.
  normalizeLineupName(value = '') {
    return value
      .toString()
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // Normalizes lineup names to canonical keys for case/whitespace-insensitive comparisons.
  normalizeLineupNameKey(value = '') {
    return this.normalizeLineupName(value).replace(/\s+/g, ' ').toLowerCase()
  }

  // Removes duplicate lineup names while preserving first-seen order.
  dedupeLineupNames(values = []) {
    const unique = []
    const seen = new Set()
    for (const item of Array.isArray(values) ? values : []) {
      const normalizedName = this.normalizeLineupName(item)
      if (!normalizedName) continue
      const key = this.normalizeLineupNameKey(normalizedName)
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(normalizedName)
    }
    return unique
  }

  // Validates and normalizes lineup payload for a single team.
  validateLineupTeamPayload({
    teamCode,
    payload,
    fallbackSquad = [],
    strictSquad = false,
  }) {
    const findDuplicateLineupNames = (values = []) => {
      const firstSeenByKey = new Map()
      const duplicates = []
      const seenDuplicateKeys = new Set()

      for (const item of Array.isArray(values) ? values : []) {
        const normalizedName = this.normalizeLineupName(item)
        if (!normalizedName) continue
        const key = this.normalizeLineupNameKey(normalizedName)
        if (!firstSeenByKey.has(key)) {
          firstSeenByKey.set(key, normalizedName)
          continue
        }
        if (seenDuplicateKeys.has(key)) continue
        seenDuplicateKeys.add(key)
        duplicates.push(firstSeenByKey.get(key))
      }

      return duplicates
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error(`lineups.${teamCode} is required`)
    }

    const providedSquad = Array.isArray(payload.squad) ? payload.squad : []
    const normalizedSquad = this.dedupeLineupNames(
      providedSquad.length ? providedSquad : fallbackSquad,
    )
    const submittedPlayingXI = Array.isArray(payload.playingXI) ? payload.playingXI : []
    const playingXI = this.dedupeLineupNames(payload.playingXI)
    const impactPlayers = this.dedupeLineupNames(payload.impactPlayers)
    const bench = this.dedupeLineupNames(payload.bench)

    if (strictSquad && !providedSquad.length) {
      throw new Error(`lineups.${teamCode}.squad is required for manual updates`)
    }
    if (playingXI.length < 11 || playingXI.length > 12) {
      const duplicates = findDuplicateLineupNames(submittedPlayingXI)
      const submittedNames = (Array.isArray(submittedPlayingXI) ? submittedPlayingXI : [])
        .map((name) => this.normalizeLineupName(name))
        .filter(Boolean)
      const duplicateText = duplicates.length
        ? ` Duplicates: ${duplicates.join(', ')}.`
        : ''
      const submittedText = submittedNames.length
        ? ` Submitted players: ${submittedNames.join(', ')}.`
        : ''
      throw new Error(
        `lineups.${teamCode}.playingXI must contain 11 or 12 unique players. Received ${playingXI.length} unique players from ${submittedPlayingXI.length} entries.${duplicateText}${submittedText} Next steps: check the full submitted list above, remove duplicates if any, and make sure exactly 11 or 12 valid player names are listed.`,
      )
    }

    const squadKeySet = new Set(
      normalizedSquad.map((name) => this.normalizeLineupNameKey(name)),
    )
    const xiOutside = playingXI.filter(
      (name) => !squadKeySet.has(this.normalizeLineupNameKey(name)),
    )
    if (xiOutside.length) {
      throw new Error(
        `lineups.${teamCode}.playingXI player "${xiOutside[0]}" is not in squad`,
      )
    }
    if (normalizedSquad.length < 11) {
      throw new Error(`lineups.${teamCode}.squad must contain at least 11 unique players`)
    }
    const impactOutside = impactPlayers.filter(
      (name) => !squadKeySet.has(this.normalizeLineupNameKey(name)),
    )
    if (impactOutside.length) {
      throw new Error(
        `lineups.${teamCode}.impactPlayers player "${impactOutside[0]}" is not in squad`,
      )
    }

    const captain = this.normalizeLineupName(payload.captain || '')
    const viceCaptain = this.normalizeLineupName(payload.viceCaptain || '')
    const playingXIKeySet = new Set(
      playingXI.map((name) => this.normalizeLineupNameKey(name)),
    )
    if (captain && !playingXIKeySet.has(this.normalizeLineupNameKey(captain))) {
      throw new Error(`lineups.${teamCode}.captain must be part of playingXI`)
    }
    if (viceCaptain && !playingXIKeySet.has(this.normalizeLineupNameKey(viceCaptain))) {
      throw new Error(`lineups.${teamCode}.viceCaptain must be part of playingXI`)
    }
    if (
      captain &&
      viceCaptain &&
      this.normalizeLineupNameKey(captain) === this.normalizeLineupNameKey(viceCaptain)
    ) {
      throw new Error(`lineups.${teamCode}.captain and viceCaptain cannot be the same`)
    }

    const playingXIKeys = new Set(
      playingXI.map((name) => this.normalizeLineupNameKey(name)),
    )

    return {
      squad: normalizedSquad,
      playingXI,
      impactPlayers,
      bench: bench.filter(
        (name) => !playingXIKeys.has(this.normalizeLineupNameKey(name)),
      ),
      captain: captain || null,
      viceCaptain: viceCaptain || null,
    }
  }

  // Returns saved lineup rows for a tournament match as a team-code keyed map.
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
          impactPlayers:
            (typeof row.meta === 'string' ? JSON.parse(row.meta || '{}') : row.meta || {})
              ?.impactPlayers || [],
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

  // Returns the full player catalog.
  async getAllPlayers() {
    const repo = await factory.getPlayerRepository()
    return await repo.findAll()
  }

  // Creates one player with payload validation and duplicate checks.
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

  // Updates one catalog player while preserving canonical identity.
  async updatePlayer(id, payload = {}) {
    const repo = await factory.getPlayerRepository()
    if (!id && id !== 0) throw new Error('Player id is required')
    const existing = await repo.findById(id)
    if (!existing) throw new Error('Player not found')
    const { fullName, country, role } = this.validatePlayerPayload(payload, {
      label: 'Player',
    })
    await this.ensureNoDuplicateCatalogPlayer({
      ...payload,
      id: existing.id,
      canonicalPlayerId: existing.id,
    })
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
      canonicalPlayerId: existing.id,
      id: existing.id,
      firstName,
      lastName,
      displayName: fullName,
      role,
      country,
      imageUrl:
        payload.imageUrl !== undefined
          ? (payload.imageUrl || '').toString().trim()
          : existing.imageUrl || '',
      battingStyle:
        payload.battingStyle !== undefined
          ? (payload.battingStyle || '').toString().trim()
          : existing.battingStyle || '',
      bowlingStyle:
        payload.bowlingStyle !== undefined
          ? (payload.bowlingStyle || '').toString().trim()
          : existing.bowlingStyle || '',
      active: payload.active !== undefined ? payload.active !== false : existing.active,
      sourceKey: existing.sourceKey || payload.sourceKey || payload.source_key || null,
      playerId: existing.playerId || payload.playerId || payload.player_id || null,
      teamKey: existing.teamKey || '',
      teamName: existing.teamName || '',
    })
  }

  // Imports multiple players and returns created/skipped/error summaries.
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

  // Deletes a single player from the catalog.
  async deletePlayer(id) {
    const repo = await factory.getPlayerRepository()
    if (!id && id !== 0) throw new Error('Player id is required')
    const deleted = await repo.delete(id)
    if (!deleted) throw new Error('Player not found')
    return { deleted: true }
  }

  // Bulk deletes players by id.
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

  // Returns players mapped to a specific team key.
  async getPlayersByTeam(teamKey) {
    const repo = await factory.getPlayerRepository()
    return await repo.findByTeam(teamKey)
  }

  // Returns stored stats for a single player.
  async getPlayerStats(playerId) {
    const repo = await factory.getPlayerRepository()
    return await repo.findStats(playerId)
  }

  // Returns tournament-level player stats and participation data.
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
          displayName: player.name,
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

  async getTournamentPlayerMatchBreakdown(tournamentId, playerId) {
    if (!tournamentId || !playerId) return []

    const result = await dbQuery(
      `SELECT pms.match_id as "matchId",
              m.name as "matchName",
              m.team_a as "teamA",
              m.team_b as "teamB",
              m.team_a_key as "teamAKey",
              m.team_b_key as "teamBKey",
              m.start_time as "startTime",
              m.status as "matchStatus",
              pms.runs,
              pms.wickets,
              pms.catches,
              pms.fours,
              pms.sixes,
              pms.maidens,
              pms.wides,
              pms.stumpings,
              pms.runout_direct as "runoutDirect",
              pms.runout_indirect as "runoutIndirect",
              pms.dismissed,
              pms.fantasy_points as "points"
       FROM player_match_scores pms
       LEFT JOIN matches m
         ON m.id::text = pms.match_id::text
       WHERE pms.tournament_id = $1
         AND pms.player_id::text = $2
       ORDER BY m.start_time ASC NULLS LAST, pms.match_id ASC`,
      [tournamentId, String(playerId)],
    )

    return result.rows.map((row) => ({
      matchId: row.matchId,
      matchName:
        row.matchName ||
        [row.teamAKey || row.teamA, 'vs', row.teamBKey || row.teamB].filter(Boolean).join(' '),
      teamA: row.teamAKey || row.teamA || '',
      teamB: row.teamBKey || row.teamB || '',
      startTime: row.startTime || null,
      status: row.matchStatus || '',
      runs: Number(row.runs || 0),
      wickets: Number(row.wickets || 0),
      catches: Number(row.catches || 0),
      fours: Number(row.fours || 0),
      sixes: Number(row.sixes || 0),
      maidens: Number(row.maidens || 0),
      wides: Number(row.wides || 0),
      stumpings: Number(row.stumpings || 0),
      runoutDirect: Number(row.runoutDirect || 0),
      runoutIndirect: Number(row.runoutIndirect || 0),
      dismissed: Boolean(row.dismissed),
      points: Number(row.points || 0),
    }))
  }

  // Builds selectable team pool for a user with contest and lineup context.
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
    const leaderboardPointsRows = await dbQuery(
      `SELECT player_id as "playerId", COALESCE(SUM(fantasy_points), 0)::float as "totalPoints"
       FROM player_match_scores
       WHERE tournament_id = $1
       GROUP BY player_id`,
      [resolvedTournamentId],
    )
    const totalPointsByPlayerId = new Map(
      (leaderboardPointsRows.rows || []).map((row) => [
        Number(row.playerId),
        Number(row.totalPoints || 0),
      ]),
    )
    const resolveMatchStartTimestamp = (match) => {
      const raw = match?.startTime || match?.startAt || match?.date || null
      const parsed = raw ? new Date(raw).getTime() : Number.NaN
      return Number.isFinite(parsed) ? parsed : 0
    }
    const activeMatchStart = resolveMatchStartTimestamp(activeMatchRaw)
    const resolvePreviousMatch = (teamCode) => {
      const normalizedTeamCode = String(teamCode || '').trim().toUpperCase()
      if (!normalizedTeamCode || !activeMatchStart) return null
      return [...tournamentMatches]
        .filter((match) => {
          const homeCode = String(match?.teamAKey || match?.teamA || '')
            .trim()
            .toUpperCase()
          const awayCode = String(match?.teamBKey || match?.teamB || '')
            .trim()
            .toUpperCase()
          return (
            [homeCode, awayCode].includes(normalizedTeamCode) &&
            resolveMatchStartTimestamp(match) < activeMatchStart
          )
        })
        .sort((left, right) => resolveMatchStartTimestamp(right) - resolveMatchStartTimestamp(left))[0]
    }
    const previousTeamAMatch = resolvePreviousMatch(teamAKey)
    const previousTeamBMatch = resolvePreviousMatch(teamBKey)
    const [previousTeamALineupMap, previousTeamBLineupMap] = await Promise.all([
      previousTeamAMatch?.id
        ? this.getMatchLineupMap(resolvedTournamentId, previousTeamAMatch.id)
        : Promise.resolve(new Map()),
      previousTeamBMatch?.id
        ? this.getMatchLineupMap(resolvedTournamentId, previousTeamBMatch.id)
        : Promise.resolve(new Map()),
    ])
    const previousTeamAPlayingSet = new Set(
      (previousTeamALineupMap.get(teamAKey)?.playingXI || []).map((name) =>
        this.normalizeLineupNameKey(name),
      ),
    )
    const previousTeamBPlayingSet = new Set(
      (previousTeamBLineupMap.get(teamBKey)?.playingXI || []).map((name) =>
        this.normalizeLineupNameKey(name),
      ),
    )

    const normalizePoolPlayer = (player) => {
      const normalizedName = this.normalizeLineupNameKey(
        player.displayName ||
          [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
      )
      const normalizedTeamCode = String(player.teamKey || '').trim().toUpperCase()
      const previousMatch =
        normalizedTeamCode === String(teamAKey || '').trim().toUpperCase()
          ? previousTeamAMatch
          : normalizedTeamCode === String(teamBKey || '').trim().toUpperCase()
            ? previousTeamBMatch
            : null
      const playedLastMatch =
        normalizedTeamCode === String(teamAKey || '').trim().toUpperCase()
          ? previousTeamAPlayingSet.has(normalizedName)
          : normalizedTeamCode === String(teamBKey || '').trim().toUpperCase()
            ? previousTeamBPlayingSet.has(normalizedName)
            : false

      return {
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
        totalPoints: Number(totalPointsByPlayerId.get(Number(player.id)) || 0),
        lastMatch: previousMatch
          ? {
              matchId: previousMatch.id,
              matchName: previousMatch.name,
              played: playedLastMatch,
            }
          : null,
      }
    }

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

  // Returns saved picks for a user with optional tournament/contest/match filters.
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
    const activePlayerIds = Array.from(pointsByPlayerId.keys())

    const isFixedRoster =
      (contest?.mode || '').toString().trim().toLowerCase() === 'fixed_roster'
    const normalizeTeamCode = (value = '') =>
      String(value || '')
        .trim()
        .toUpperCase()
    const lineupStatusResolver = (() => {
      if (!matchId) {
        return () => ''
      }

      let matchRecord = null
      let lineupMap = null
      let hasAnyAnnouncedLineup = false
      const teamLineupSetByCode = new Map()

      return async (entry = {}) => {
        if (!lineupMap) {
          matchRecord = matchRepo.findById ? await matchRepo.findById(matchId) : null
          lineupMap = await this.getMatchLineupMap(resolvedTournamentId, matchId)
          const homeCode = normalizeTeamCode(
            matchRecord?.teamAKey || matchRecord?.teamA || '',
          )
          const awayCode = normalizeTeamCode(
            matchRecord?.teamBKey || matchRecord?.teamB || '',
          )
          const homeLineup = lineupMap.get(homeCode)?.playingXI || []
          const awayLineup = lineupMap.get(awayCode)?.playingXI || []

          const homeSet = new Set(
            homeLineup.map((name) => this.normalizeLineupNameKey(name)),
          )
          const awaySet = new Set(
            awayLineup.map((name) => this.normalizeLineupNameKey(name)),
          )
          if (homeCode) teamLineupSetByCode.set(homeCode, homeSet)
          if (awayCode) teamLineupSetByCode.set(awayCode, awaySet)
          hasAnyAnnouncedLineup = homeSet.size > 0 || awaySet.size > 0
        }

        if (!hasAnyAnnouncedLineup) return ''
        const playerNameKey = this.normalizeLineupNameKey(entry?.name || '')
        if (!playerNameKey) return ''

        const playerTeamCode = normalizeTeamCode(entry?.team || '')
        if (playerTeamCode && teamLineupSetByCode.has(playerTeamCode)) {
          const teamSet = teamLineupSetByCode.get(playerTeamCode)
          return teamSet?.has(playerNameKey) ? 'playing' : 'bench'
        }
        return ''
      }
    })()

    const decorateWithLineupStatus = async (rows = []) => {
      const next = []
      for (const row of rows) {
        next.push({
          ...row,
          lineupStatus: await lineupStatusResolver(row),
        })
      }
      return next
    }

    const scoringRuleRecord =
      await scoringRuleService.getScoringRulesByTournament(resolvedTournamentId)
    const ruleSet = getRuleSetForTournament({
      tournamentId: resolvedTournamentId,
      scoringRules: scoringRuleRecord?.rules
        ? [{ tournamentId: resolvedTournamentId, rules: scoringRuleRecord.rules }]
        : [],
      dashboardRuleTemplate: cloneDefaultPointsRules(),
    })
    const matchScoreRows =
      matchId != null
        ? await dbQuery(
            `SELECT player_id as "playerId", raw_stats as "rawStats"
             FROM player_match_scores
             WHERE tournament_id = $1 AND match_id = $2`,
            [resolvedTournamentId, matchId],
          )
        : { rows: [] }
    const statsByPlayerId = new Map(
      (matchScoreRows.rows || []).map((row) => [
        Number(row.playerId),
        typeof row.rawStats === 'string' ? JSON.parse(row.rawStats) : row.rawStats || {},
      ]),
    )
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
      const contestMatchIds = Array.isArray(contest?.matchIds)
        ? contest.matchIds.map((value) => String(value || '').trim()).filter(Boolean)
        : []
      const aggregateResult =
        contestMatchIds.length && playerIds.length
          ? await dbQuery(
              `SELECT player_id as "playerId", SUM(fantasy_points)::float as "totalPoints"
               FROM player_match_scores
               WHERE tournament_id = $1
                 AND match_id::text = ANY($2::text[])
                 AND player_id = ANY($3::bigint[])
               GROUP BY player_id`,
              [resolvedTournamentId, contestMatchIds, playerIds],
            )
          : { rows: [] }
      const totalPointsByPlayerId = new Map(
        (aggregateResult.rows || []).map((row) => [
          Number(row.playerId),
          Number(row.totalPoints || 0),
        ]),
      )
      const rosterDetailed = playerIds
        .map((id, index) => {
          const base = playerById.get(String(id))
          if (!base) return null
          return {
            ...base,
            rosterSlot: index + 1,
          }
        })
        .filter(Boolean)
        .map((entry) => {
          const stats = statsByPlayerId.get(Number(entry.id)) || null
          const basePoints = Number(pointsByPlayerId.get(Number(entry.id)) || 0)
          return {
            ...entry,
            basePoints,
            multiplier: 1,
            points: basePoints,
            totalPoints: Number(totalPointsByPlayerId.get(Number(entry.id)) || 0),
            roleTag: '',
            rawStats: stats,
            pointBreakdown: stats ? calculateFantasyPointBreakdown(stats, ruleSet) : [],
          }
        })
      const rankedRoster = [...rosterDetailed].sort((left, right) => {
        if (Number(right.totalPoints || 0) !== Number(left.totalPoints || 0)) {
          return Number(right.totalPoints || 0) - Number(left.totalPoints || 0)
        }
        return Number(left.rosterSlot || 0) - Number(right.rosterSlot || 0)
      })
      const picksDetailed = rankedRoster.slice(0, 11)
      const backupsDetailed = rankedRoster.slice(11)
      const picksWithStatus = await decorateWithLineupStatus(picksDetailed)
      const backupsWithStatus = await decorateWithLineupStatus(backupsDetailed)
      return {
        userId,
        tournamentId: resolvedTournamentId,
        contestId,
        matchId,
        picks: picksWithStatus.map((row) => row.name),
        backups: backupsWithStatus.map((row) => row.name),
        picksDetailed: picksWithStatus,
        backupsDetailed: backupsWithStatus,
      }
    }

    const selection =
      matchId && userId
        ? await teamSelectionRepo.findByMatchAndUser(matchId, userId, contest?.id || null)
        : null
    const ownershipSelectionRows =
      matchId && contest?.id
        ? await dbQuery(
            `SELECT ts.user_id as "userId",
                    ts.playing_xi as "playingXi",
                    ts.backups,
                    ts.captain_id as "captainId",
                    ts.vice_captain_id as "viceCaptainId",
                    u.game_name as "gameName",
                    u.name
             FROM team_selections ts
             JOIN users u ON u.id = ts.user_id
             WHERE ts.contest_id = $1
               AND ts.match_id = $2`,
            [contest.id, matchId],
          )
        : { rows: [] }
    const selectionSourceRows =
      matchId && contest?.id && userId
        ? await dbQuery(
            `SELECT player_id as "playerId", source
             FROM contest_match_players
             WHERE contest_id = $1 AND match_id = $2 AND user_id = $3`,
            [contest.id, matchId, userId],
          )
        : { rows: [] }
    const savedAutoSwapPlayerIdSet = new Set()
    const savedReplacementMap = new Map()
    for (const row of selectionSourceRows.rows || []) {
      const numericPlayerId = Number(row?.playerId)
      const source = String(row?.source || '').trim()
      if (!numericPlayerId || !source.startsWith('selection-auto-swap')) continue
      savedAutoSwapPlayerIdSet.add(numericPlayerId)
      const [, replacedIdRaw = ''] = source.split(':')
      const replacedPlayerId = Number(replacedIdRaw)
      if (replacedPlayerId) {
        savedReplacementMap.set(numericPlayerId, replacedPlayerId)
      }
    }
    const resolvedSelection = resolveEffectiveSelection({
      playingXi: selection?.playingXi || [],
      backups: selection?.backups || [],
      activePlayerIds,
      captainId: selection?.captainId || null,
      viceCaptainId: selection?.viceCaptainId || null,
    })
    const ownershipByPlayerId = new Map()
    for (const row of ownershipSelectionRows.rows || []) {
      const resolvedRowSelection = resolveEffectiveSelection({
        playingXi: Array.isArray(row?.playingXi) ? row.playingXi : [],
        backups: Array.isArray(row?.backups) ? row.backups : [],
        activePlayerIds,
        captainId: row?.captainId || null,
        viceCaptainId: row?.viceCaptainId || null,
      })
      const resolvedCaptainId = resolvedRowSelection.resolvedCaptainId ?? row?.captainId
      const resolvedViceCaptainId =
        resolvedRowSelection.resolvedViceCaptainId ?? row?.viceCaptainId
      for (const playerId of resolvedRowSelection.nextPlayingXi || []) {
        const numericPlayerId = Number(playerId)
        if (!numericPlayerId) continue
        const current =
          ownershipByPlayerId.get(numericPlayerId) || {
            pickedByCount: 0,
            captainCount: 0,
            viceCaptainCount: 0,
            pickedBy: [],
          }
        let roleTag = ''
        if (
          resolvedRowSelection.captainApplies &&
          Number(resolvedCaptainId) === numericPlayerId
        ) {
          roleTag = 'C'
          current.captainCount += 1
        } else if (
          resolvedRowSelection.viceCaptainApplies &&
          Number(resolvedViceCaptainId) === numericPlayerId
        ) {
          roleTag = 'VC'
          current.viceCaptainCount += 1
        }
        current.pickedByCount += 1
        current.pickedBy.push({
          userId: row?.gameName || String(row?.userId || ''),
          name: row?.gameName || row?.name || String(row?.userId || ''),
          roleTag,
        })
        ownershipByPlayerId.set(numericPlayerId, current)
      }
    }
    ownershipByPlayerId.forEach((value) => {
      value.pickedBy.sort((left, right) => {
        if (String(left?.roleTag || '') !== String(right?.roleTag || '')) {
          const rank = { C: 0, VC: 1, '': 2 }
          return (
            (rank[String(left?.roleTag || '')] ?? 3) -
            (rank[String(right?.roleTag || '')] ?? 3)
          )
        }
        return String(left?.name || '').localeCompare(String(right?.name || ''))
      })
    })
    const promotedBackupIdSet = new Set(
      (resolvedSelection.promotedBackupIds || []).map((id) => Number(id)),
    )
    const liveReplacementMap = new Map(
      (resolvedSelection.replacementPairs || []).map((pair) => [
        Number(pair?.promotedBackupId),
        Number(pair?.benchedPlayerId),
      ]),
    )
    const buildPreviewEntry = (id, { forcePlainMultiplier = false } = {}) => {
      const baseEntry = playerById.get(String(id))
      if (!baseEntry) return null

      const numericId = Number(id)
      const basePoints = Number(pointsByPlayerId.get(numericId) || 0)
      const stats = statsByPlayerId.get(numericId) || null
      const isAutoSwapped =
        promotedBackupIdSet.has(numericId) || savedAutoSwapPlayerIdSet.has(numericId)
      const replacedPlayerId =
        liveReplacementMap.get(numericId) || savedReplacementMap.get(numericId) || null
      const replacedPlayer = replacedPlayerId
        ? playerById.get(String(replacedPlayerId))
        : null
      const replacementInfo = replacedPlayer?.name
        ? `Promoted from backups because ${replacedPlayer.name} was not in the announced playing XI.`
        : 'Promoted from backups because a picked XI player was not in the announced playing XI.'

      let multiplier = 1
      let roleTag = ''
      // Use resolved C/VC after backup replacement
      const resolvedCaptainId =
        resolvedSelection.resolvedCaptainId ?? selection?.captainId
      const resolvedViceCaptainId =
        resolvedSelection.resolvedViceCaptainId ?? selection?.viceCaptainId
      if (!forcePlainMultiplier) {
        if (resolvedSelection.captainApplies && Number(resolvedCaptainId) === numericId) {
          multiplier = 2
          roleTag = 'C'
        } else if (
          resolvedSelection.viceCaptainApplies &&
          Number(resolvedViceCaptainId) === numericId
        ) {
          multiplier = 1.5
          roleTag = 'VC'
        }
      }

      return {
        ...baseEntry,
        basePoints,
        multiplier,
        points: basePoints * multiplier,
        roleTag,
        selectionSource: isAutoSwapped ? 'selection-auto-swap' : 'selection',
        autoSwapped: isAutoSwapped,
        replacementInfo,
        ownership: ownershipByPlayerId.get(numericId) || null,
        rawStats: stats,
        pointBreakdown: stats ? calculateFantasyPointBreakdown(stats, ruleSet) : [],
      }
    }

    const picksDetailedRaw = (
      resolvedSelection.nextPlayingXi ||
      selection?.playingXi ||
      []
    )
      .map((id) => buildPreviewEntry(id))
      .filter(Boolean)
    const backupsDetailedRaw = (resolvedSelection.nextBackups || selection?.backups || [])
      .map((id) => buildPreviewEntry(id, { forcePlainMultiplier: true }))
      .filter(Boolean)
    const picksDetailed = await decorateWithLineupStatus(picksDetailedRaw)
    const backupsDetailed = await decorateWithLineupStatus(backupsDetailedRaw)
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

  // Returns team squad mappings for a tournament.
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

  // Creates or updates one team squad mapping.
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

  // Imports bulk team-squad mappings from admin payload format.
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

  // Deletes a team squad mapping for a team and optional tournament.
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

  // Returns admin-facing lineup payload for a tournament match.
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

  // Creates or updates match lineup entries for both teams in a match.
  async upsertMatchLineups(tournamentId, matchId, lineups, meta = {}) {
    const matchRepo = await factory.getMatchRepository()
    const match = await matchRepo.findById(matchId)
    if (!match || String(match.tournamentId) !== String(tournamentId)) {
      throw new Error('Match not found')
    }
    if (
      lineups &&
      typeof lineups === 'object' &&
      !Array.isArray(lineups) &&
      Array.isArray(lineups.playerStats)
    ) {
      throw new Error(
        'Received scorecard payload on lineup save. Use Scorecards > JSON Upload to save playerStats.',
      )
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
        strictSquad: meta?.strictSquad === true,
      })
      if (meta?.dryRun === true) {
        continue
      }
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
          JSON.stringify({
            ...(meta?.meta || {}),
            impactPlayers: normalizedLineups[teamCode].impactPlayers || [],
          }),
        ],
      )
    }

    return {
      ok: true,
      dryRun: meta?.dryRun === true,
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
