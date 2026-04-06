import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import { cloneDefaultPointsRules } from '../default-points-rules.js'
import scoringRuleService from './scoring-rule.service.js'
import {
  buildPlayerIdentityIndex,
  calculateFantasyPoints,
  getRuleSetForTournament,
  normalizePlayerStatRows,
  resolvePlayerStatPlayer,
  resolveEffectiveSelection,
} from '../scoring.js'

const factory = createRepositoryFactory()
const FIXED_ROSTER_COUNTED_SIZE = 11

const sumTopFixedRosterPoints = (playerIds = [], fantasyPointsByPlayerId = new Map()) => {
  const scored = (Array.isArray(playerIds) ? playerIds : [])
    .map((playerId) => Number(fantasyPointsByPlayerId.get(Number(playerId)) || 0))
    .sort((a, b) => b - a)
  return scored.slice(0, FIXED_ROSTER_COUNTED_SIZE).reduce((sum, value) => sum + value, 0)
}

class MatchScoreService {
  async resetMatchScores(matchId, tournamentId, resetBy) {
    if (!matchId || !tournamentId) {
      throw new Error('matchId and tournamentId are required')
    }

    const matchRepo = await factory.getMatchRepository()
    const match = await matchRepo.findById(matchId)
    if (!match) throw new Error('Match not found')
    if (String(match.tournamentId) !== String(tournamentId)) {
      throw new Error('matchId does not belong to the provided tournamentId')
    }

    const deactivatedResult = await dbQuery(
      `UPDATE match_scores
       SET active = false,
           updated_at = now(),
           uploaded_by = COALESCE($3::bigint, uploaded_by)
       WHERE match_id = $1
         AND tournament_id = $2
         AND active = true
       RETURNING id`,
      [matchId, tournamentId, resetBy || null],
    )

    await dbQuery(
      `DELETE FROM player_match_scores
       WHERE match_id = $1
         AND tournament_id = $2`,
      [matchId, tournamentId],
    )

    const deletedContestScores = await dbQuery(
      `DELETE FROM contest_scores cs
       USING contests c
       WHERE cs.contest_id = c.id
         AND c.tournament_id = $1
         AND cs.match_id = $2
       RETURNING cs.contest_id`,
      [tournamentId, matchId],
    )

    return {
      ok: true,
      matchId: String(matchId),
      tournamentId: String(tournamentId),
      deactivatedScores: deactivatedResult.rows.length,
      impactedContests: new Set(
        (deletedContestScores.rows || []).map((row) => String(row.contest_id || '')),
      ).size,
      resetAt: new Date().toISOString(),
    }
  }

  validatePlayerStatsPayload(playerStats = []) {
    if (!Array.isArray(playerStats) || !playerStats.length) {
      throw new Error('playerStats array required')
    }
    playerStats.forEach((row, index) => {
      const hasIdentity =
        (row?.playerId != null && `${row.playerId}`.toString().trim()) ||
        (row?.playerName || '').toString().trim()
      if (!hasIdentity) {
        throw new Error(`playerStats[${index}] must include playerId or playerName`)
      }
      const numericFields = [
        'runs',
        'wickets',
        'catches',
        'fours',
        'sixes',
        'maidens',
        'wides',
        'stumpings',
        'runoutDirect',
        'runoutIndirect',
        'ballsFaced',
        'oversBowled',
        'runsConceded',
      ]
      numericFields.forEach((field) => {
        if (row?.[field] == null || row[field] === '') return
        const value = Number(row[field])
        if (!Number.isFinite(value) || value < 0) {
          throw new Error(`playerStats[${index}].${field} must be a non-negative number`)
        }
      })
      if (row?.dismissed != null && typeof row.dismissed !== 'boolean') {
        throw new Error(`playerStats[${index}].dismissed must be true or false`)
      }
    })
  }

  async uploadMatchScores(matchId, tournamentId, playerStats, uploadedBy) {
    if (!matchId || !tournamentId) {
      throw new Error('matchId and tournamentId are required')
    }
    this.validatePlayerStatsPayload(playerStats)
    await this.validatePlayersBelongToMatchTeams(matchId, tournamentId, playerStats)
    // Deactivate previous scores
    const repo = await factory.getMatchScoreRepository()
    await repo.deactivatePrevious(matchId)
    // Create new score
    const savedScore = await repo.create({
      matchId,
      tournamentId,
      playerStats,
      uploadedBy,
    })
    const { contestSummaries } = await this.rebuildDerivedScores({
      matchId,
      tournamentId,
      playerStats,
    })
    return {
      ok: true,
      savedAt: new Date().toISOString(),
      savedScore,
      impactedContests: contestSummaries.length,
      contestSummaries,
    }
  }

  async validatePlayersBelongToMatchTeams(matchId, tournamentId, playerStats = []) {
    const matchRepo = await factory.getMatchRepository()
    const playerRepo = await factory.getPlayerRepository()

    const match = await matchRepo.findById(matchId)
    if (!match) {
      throw new Error('Match not found')
    }
    if (String(match.tournamentId) !== String(tournamentId)) {
      throw new Error('matchId does not belong to the provided tournamentId')
    }

    const matchTeamCodes = [match.teamAKey || match.teamA, match.teamBKey || match.teamB]
      .map((item) => (item || '').toString().trim())
      .filter(Boolean)

    if (!matchTeamCodes.length) {
      throw new Error('Selected match has no team mapping for score validation')
    }

    const matchPlayers = (
      await Promise.all(
        matchTeamCodes.map((teamCode) => playerRepo.findByTeam(teamCode, tournamentId)),
      )
    )
      .flat()
      .map((player) => ({
        ...player,
        name:
          player.displayName ||
          [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
        team: player.teamKey || player.team,
      }))

    const identityIndex = buildPlayerIdentityIndex(matchPlayers)

    const invalidEntries = []
    for (const row of playerStats) {
      if (!row || typeof row !== 'object') continue
      const incomingName = (row.playerName || row.name || '').toString().trim()
      const incomingId = (row.playerId || '').toString().trim()
      const resolvedPlayer = resolvePlayerStatPlayer(row, identityIndex)
      if (!resolvedPlayer) {
        invalidEntries.push(incomingName || incomingId || 'unknown-player')
      }
    }

    if (invalidEntries.length) {
      const preview = invalidEntries.slice(0, 5).join(', ')
      throw new Error(
        `Submitted score JSON includes players not in selected match teams: ${preview}`,
      )
    }

    const normalizedRows = normalizePlayerStatRows(playerStats || [], matchPlayers)
    if (!normalizedRows.length) {
      throw new Error('No valid playerStats rows found for the selected match teams')
    }
  }

  async getMatchScores(tournamentId, matchId) {
    const repo = await factory.getMatchScoreRepository()
    return await repo.findByMatch(matchId)
  }

  async getActiveMatchScore(matchId) {
    const repo = await factory.getMatchScoreRepository()
    return await repo.findLatestActive(matchId)
  }

  async processExcelScores(excelData) {
    // Parse Excel data and return formatted for upload
    return { data: excelData, validated: true }
  }

  async saveExcelProcessedScores(matchId, tournamentId, playerStats, uploadedBy) {
    return await this.uploadMatchScores(matchId, tournamentId, playerStats, uploadedBy)
  }

  async getPlayerOverridesContext(tournamentId) {
    // Get context data for player overrides UI
    return { overrides: [], context: {} }
  }

  async savePlayerOverrides(tournamentId, overrides) {
    // Save player stat overrides
    return { saved: true, count: overrides.length }
  }

  async rebuildStoredMatchScore(scoreRow) {
    if (!scoreRow?.matchId || !scoreRow?.tournamentId) {
      return { contestSummaries: [] }
    }
    const playerStats =
      typeof scoreRow.playerStats === 'string'
        ? JSON.parse(scoreRow.playerStats)
        : scoreRow.playerStats || []
    return this.rebuildDerivedScores({
      matchId: scoreRow.matchId,
      tournamentId: scoreRow.tournamentId,
      playerStats,
    })
  }

  async rebuildAllDerivedScores({ tournamentId = null } = {}) {
    const params = []
    const tournamentFilter = tournamentId
      ? `where active = true and tournament_id = $1`
      : `where active = true`
    if (tournamentId) params.push(tournamentId)
    const scoreResult = await dbQuery(
      `select id, match_id as "matchId", tournament_id as "tournamentId", player_stats as "playerStats"
       from match_scores
       ${tournamentFilter}
       order by tournament_id asc, match_id asc, created_at asc`,
      params,
    )
    const activeScores = scoreResult.rows || []
    if (tournamentId) {
      await dbQuery(`delete from player_match_scores where tournament_id = $1`, [
        tournamentId,
      ])
      await dbQuery(
        `delete from contest_scores
         where contest_id in (select id from contests where tournament_id = $1)`,
        [tournamentId],
      )
    } else {
      await dbQuery(`delete from player_match_scores`)
      await dbQuery(`delete from contest_scores`)
    }

    const touchedContestIds = new Set()
    for (const scoreRow of activeScores) {
      const { contestSummaries } = await this.rebuildStoredMatchScore(scoreRow)
      for (const summary of contestSummaries || []) {
        if (summary?.contestId != null) touchedContestIds.add(String(summary.contestId))
      }
    }

    return {
      rebuiltMatches: activeScores.length,
      rebuiltContests: touchedContestIds.size,
      tournamentId: tournamentId || null,
    }
  }

  async rebuildDerivedScores({ matchId, tournamentId, playerStats }) {
    const matchRepo = await factory.getMatchRepository()
    const playerRepo = await factory.getPlayerRepository()
    const contestRepo = await factory.getContestRepository()
    const scoringRuleRepo = await factory.getScoringRuleRepository()

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
    const playerRowsSource =
      typeof playerRepo.findByTournament === 'function'
        ? await playerRepo.findByTournament(tournamentId)
        : (
            await Promise.all(
              teamKeys.map((teamKey) => playerRepo.findByTeam(teamKey, tournamentId)),
            )
          ).flat()
    const playerRows = playerRowsSource.map((player) => ({
      ...player,
      name:
        player.displayName ||
        [player.firstName, player.lastName].filter(Boolean).join(' ').trim(),
      team: player.teamKey,
    }))
    const scoringRule = await scoringRuleRepo.findByTournament(tournamentId)
    const globalScoringRules = await scoringRuleService.getDefaultScoringRules()
    const ruleSet = getRuleSetForTournament({
      tournamentId,
      scoringRules: scoringRule ? [scoringRule] : [],
      dashboardRuleTemplate: globalScoringRules?.rules || cloneDefaultPointsRules(),
    })
    const normalizedRows = normalizePlayerStatRows(playerStats || [], playerRows)
    await dbQuery(
      `DELETE FROM player_match_scores
       WHERE tournament_id = $1 AND match_id = $2`,
      [tournamentId, matchId],
    )
    const fantasyPointsByPlayerId = new Map()
    for (const row of normalizedRows) {
      const fantasyPoints = Number(calculateFantasyPoints(row, ruleSet) || 0)
      fantasyPointsByPlayerId.set(Number(row.playerId), fantasyPoints)
      await dbQuery(
        `INSERT INTO player_match_scores (
           tournament_id, match_id, player_id, raw_stats,
           runs, wickets, catches, fours, sixes, maidens, wides, stumpings,
           runout_direct, runout_indirect, dismissed, fantasy_points, created_at, updated_at
         )
         VALUES (
           $1, $2, $3, $4,
           $5, $6, $7, $8, $9, $10, $11, $12,
           $13, $14, $15, $16, now(), now()
         )
         ON CONFLICT (tournament_id, match_id, player_id) DO UPDATE
         SET raw_stats = EXCLUDED.raw_stats,
             runs = EXCLUDED.runs,
             wickets = EXCLUDED.wickets,
             catches = EXCLUDED.catches,
             fours = EXCLUDED.fours,
             sixes = EXCLUDED.sixes,
             maidens = EXCLUDED.maidens,
             wides = EXCLUDED.wides,
             stumpings = EXCLUDED.stumpings,
             runout_direct = EXCLUDED.runout_direct,
             runout_indirect = EXCLUDED.runout_indirect,
             dismissed = EXCLUDED.dismissed,
             fantasy_points = EXCLUDED.fantasy_points,
             updated_at = now()`,
        [
          tournamentId,
          matchId,
          row.playerId,
          JSON.stringify(row),
          Number(row.runs || 0),
          Number(row.wickets || 0),
          Number(row.catches || 0),
          Number(row.fours || 0),
          Number(row.sixes || 0),
          Number(row.maidens || 0),
          Number(row.wides || 0),
          Number(row.stumpings || 0),
          Number(row.runoutDirect || 0),
          Number(row.runoutIndirect || 0),
          row.dismissed === true,
          fantasyPoints,
        ],
      )
    }

    const contests = await contestRepo.findByTournament(tournamentId)
    const lineupResult = await dbQuery(
      `SELECT team_code as "teamCode", playing_xi as "playingXI"
       FROM match_lineups
       WHERE tournament_id = $1 AND match_id = $2`,
      [tournamentId, matchId],
    )
    const activePlayerIdsByTeam = new Map()
    const playerIdByTeamAndName = new Map(
      playerRows.map((player) => [
        `${String(player.team || '').trim()}::${String(player.name || '')
          .trim()
          .toLowerCase()}`,
        Number(player.id),
      ]),
    )
    for (const row of lineupResult.rows || []) {
      const playingXI =
        typeof row.playingXI === 'string'
          ? JSON.parse(row.playingXI)
          : row.playingXI || []
      const ids = playingXI
        .map((name) =>
          playerIdByTeamAndName.get(
            `${String(row.teamCode || '').trim()}::${String(name || '')
              .trim()
              .toLowerCase()}`,
          ),
        )
        .filter(Boolean)
      activePlayerIdsByTeam.set(String(row.teamCode || '').trim(), ids)
    }
    const contestSummaries = []
    for (const contest of contests) {
      const scopedMatchIds = Array.isArray(contest?.matchIds)
        ? contest.matchIds.map(String)
        : []
      if (scopedMatchIds.length && !scopedMatchIds.includes(String(matchId))) continue

      await dbQuery(
        `DELETE FROM contest_scores WHERE contest_id = $1 AND match_id = $2`,
        [contest.id, matchId],
      )

      let rows = []
      if ((contest.mode || '').toString().trim().toLowerCase() === 'fixed_roster') {
        const fixedRosterResult = await dbQuery(
          `SELECT user_id as "userId", player_ids as "playerIds"
           FROM contest_fixed_rosters
           WHERE contest_id = $1`,
          [contest.id],
        )
        rows = fixedRosterResult.rows.map((row) => ({
          userId: row.userId,
          points: sumTopFixedRosterPoints(row.playerIds, fantasyPointsByPlayerId),
        }))
      } else {
        const matchRecord =
          (matches || []).find((item) => String(item.id) === String(matchId)) || null
        const matchTeamKeys = [
          String(matchRecord?.teamAKey || matchRecord?.teamA || '').trim(),
          String(matchRecord?.teamBKey || matchRecord?.teamB || '').trim(),
        ].filter(Boolean)
        const activePlayerIds = [
          ...(activePlayerIdsByTeam.get(matchTeamKeys[0]) || []),
          ...(activePlayerIdsByTeam.get(matchTeamKeys[1]) || []),
        ]
        const selections = await dbQuery(
          `SELECT user_id as "userId",
                  captain_id as "captainId",
                  vice_captain_id as "viceCaptainId",
                  playing_xi as "playingXi",
                  backups
           FROM team_selections
           WHERE contest_id = $1 AND match_id = $2`,
          [contest.id, matchId],
        )
        rows = selections.rows.map((row) => {
          const playingXi =
            typeof row.playingXi === 'string'
              ? JSON.parse(row.playingXi)
              : row.playingXi || []
          const backups =
            typeof row.backups === 'string' ? JSON.parse(row.backups) : row.backups || []
          const resolved = resolveEffectiveSelection({
            playingXi,
            backups,
            activePlayerIds,
            captainId: row.captainId,
            viceCaptainId: row.viceCaptainId,
          })
          const points = resolved.effectivePlayerIds.reduce((sum, playerId) => {
            const base = Number(fantasyPointsByPlayerId.get(Number(playerId)) || 0)
            let multiplier = 1
            if (resolved.captainApplies && Number(row.captainId) === Number(playerId))
              multiplier = 2
            else if (
              resolved.viceCaptainApplies &&
              Number(row.viceCaptainId) === Number(playerId)
            )
              multiplier = 1.5
            return sum + base * multiplier
          }, 0)
          return {
            userId: row.userId,
            points,
          }
        })
      }

      for (const row of rows) {
        await dbQuery(
          `INSERT INTO contest_scores (contest_id, match_id, user_id, points, created_at, updated_at)
           VALUES ($1, $2, $3, $4, now(), now())
           ON CONFLICT (contest_id, match_id, user_id) DO UPDATE
           SET points = EXCLUDED.points, updated_at = now()`,
          [contest.id, matchId, row.userId, Number(row.points || 0)],
        )
      }
      contestSummaries.push({
        contestId: contest.id,
        updatedUsers: rows.length,
      })
    }

    return { contestSummaries }
  }
}

export default new MatchScoreService()
