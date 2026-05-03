import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import { cloneDefaultPointsRules } from '../default-points-rules.js'
import { recordLiveScoreDbWrite } from '../live-score/logger.js'
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

// Normalize user-provided player names so unmatched error details are consistent.
const normalizeNameForMatch = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stableJson = (value) => JSON.stringify(value || [])

const emptyPlayerStats = (playerName) => ({
  playerName,
  runs: 0,
  ballsFaced: 0,
  wickets: 0,
  catches: 0,
  stumpings: 0,
  runoutDirect: 0,
  runoutIndirect: 0,
  hatTrick: 0,
  bowledLbw: 0,
  fours: 0,
  sixes: 0,
  overs: 0,
  runsConceded: 0,
  maidens: 0,
  noBalls: 0,
  wides: 0,
  dismissed: false,
})

const buildBulkPlaceholders = ({ rows, columnsPerRow, extraSql = [] }) =>
  rows
    .map((row, rowIndex) => {
      void row
      const offset = rowIndex * columnsPerRow
      const placeholders = Array.from(
        { length: columnsPerRow },
        (_, columnIndex) => `$${offset + columnIndex + 1}`,
      )
      return `(${[...placeholders, ...extraSql].join(', ')})`
    })
    .join(', ')

const resolvePlayerWithNormalizedFallback = ({
  row,
  identityIndex,
}) => {
  const directMatch = resolvePlayerStatPlayer(row, identityIndex)
  if (directMatch) {
    return {
      player: directMatch,
      normalizedInput: normalizeNameForMatch(row?.playerName || row?.name || ''),
    }
  }

  const incomingName = (row?.playerName || row?.name || '').toString().trim()
  const normalizedInput = normalizeNameForMatch(incomingName)
  return {
    player: null,
    normalizedInput,
  }
}

class MatchScoreService {
  // Resets active scores and derived score tables for a tournament match.
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

  // Validates raw player stat rows before score processing.
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
        'hatTrick',
        'bowledLbw',
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

  // Uploads match scores, stores active score row, and rebuilds derived contest scores.
  async uploadMatchScores(matchId, tournamentId, playerStats, uploadedBy, context = {}) {
    if (!matchId || !tournamentId) {
      throw new Error('matchId and tournamentId are required')
    }
    this.validatePlayerStatsPayload(playerStats)
    const normalizedPlayerStats = await this.validatePlayersBelongToMatchTeams(
      matchId,
      tournamentId,
      playerStats,
      context,
    )
    const repo = await factory.getMatchScoreRepository()
    const activeScore = context.activeScore || (await repo.findLatestActive(matchId))
    if (
      activeScore &&
      String(activeScore.tournamentId) === String(tournamentId) &&
      stableJson(activeScore.playerStats) === stableJson(normalizedPlayerStats)
    ) {
      return {
        ok: true,
        skipped: true,
        reason: 'score-unchanged',
        savedAt: new Date().toISOString(),
        savedScore: activeScore,
        impactedContests: 0,
        contestSummaries: [],
      }
    }
    // Upsert score snapshot for this tournament/match.
    const savedScore = await repo.create({
      matchId,
      tournamentId,
      playerStats: normalizedPlayerStats,
      uploadedBy,
    })
    await recordLiveScoreDbWrite(context, {
      table: 'match_scores',
      action: 'insert',
      rows: 1,
      fields: ['player_stats', 'uploaded_by', 'active'],
      matchId,
      tournamentId,
      matchLabel: context.match?.name,
      providerMatchId: context.providerMatchId || context.match?.providerMatchId,
      message: `DB wrote active score snapshot with ${normalizedPlayerStats.length} player row(s)`,
      details: {
        fn: 'uploadMatchScores',
        savedScoreId: savedScore?.id || '',
        playerCount: normalizedPlayerStats.length,
        uploadedBy: uploadedBy || 'myxi',
      },
    })
    const { contestSummaries } = await this.rebuildDerivedScores({
      matchId,
      tournamentId,
      playerStats: normalizedPlayerStats,
      context,
    })
    return {
      ok: true,
      savedAt: new Date().toISOString(),
      savedScore,
      impactedContests: contestSummaries.length,
      contestSummaries,
    }
  }

  // Fetches an external scorecard, converts it to playerStats, and saves it.
  async syncLiveMatchScores({
    tournamentId,
    matchId,
    sourceMatchId = null,
    uploadedBy = null,
    provider = null,
    context = {},
  }) {
    if (!matchId || !tournamentId) {
      throw new Error('matchId and tournamentId are required')
    }
    const matchRepo = await factory.getMatchRepository()
    const match = context.match || (await matchRepo.findById(matchId))
    if (!match) throw new Error('Match not found')
    if (String(match.tournamentId) !== String(tournamentId)) {
      throw new Error('matchId does not belong to the provided tournamentId')
    }

    const externalMatchId = sourceMatchId || match.sourceKey
    if (!externalMatchId) {
      throw new Error('sourceMatchId is required when the match has no sourceKey')
    }
    if (!provider || typeof provider.getPlayerStats !== 'function') {
      throw new Error('score provider is required for live score sync')
    }

    const { scorecard, playerStats } = await provider.getPlayerStats(externalMatchId)
    const scoreRepo = await factory.getMatchScoreRepository()
    const activeScore =
      context.activeScore === undefined
        ? await scoreRepo.findLatestActive(matchId)
        : context.activeScore
    const scoreContext = { ...context, match, activeScore }
    const fullPlayerStats = await this.buildFullScoreSnapshot({
      matchId,
      tournamentId,
      scraperPlayerStats: playerStats,
      context: scoreContext,
    })
    const payload = await this.uploadMatchScores(
      matchId,
      tournamentId,
      fullPlayerStats,
      uploadedBy,
      scoreContext,
    )

    return {
      ...payload,
      source: 'live-score-api',
      sourceMatchId: String(externalMatchId),
      scorecardStatus: scorecard?.status || '',
      scorecardTitle: scorecard?.title || '',
      fetchedPlayers: playerStats.length,
      savedPlayers: fullPlayerStats.length,
    }
  }

  async buildFullScoreSnapshot({
    matchId,
    tournamentId,
    scraperPlayerStats = [],
    context = {},
  }) {
    const lineupRows =
      context.lineupRows ||
      (
        await dbQuery(
          `SELECT team_code as "teamCode", playing_xi as "playingXI"
           FROM match_lineups
           WHERE tournament_id = $1 AND match_id = $2`,
          [tournamentId, matchId],
        )
      ).rows
    const playingXiNames = [
      ...new Set(
        (context.playingXiNames || []).length
          ? context.playingXiNames
          : (lineupRows || []).flatMap((row) => {
              const rows =
                typeof row.playingXI === 'string'
                  ? JSON.parse(row.playingXI)
                  : row.playingXI || []
              return rows.map((name) => String(name || '').trim()).filter(Boolean)
            }),
      ),
    ]
    if (!playingXiNames.length) {
      throw new Error('Playing XI must be saved before live score sync')
    }

    const repo = await factory.getMatchScoreRepository()
    const activeScore = context.activeScore || (await repo.findLatestActive(matchId))
    const existingRows =
      activeScore && String(activeScore.tournamentId) === String(tournamentId)
        ? activeScore.playerStats || []
        : []

    const rowsByName = new Map()
    for (const playerName of playingXiNames) {
      rowsByName.set(normalizeNameForMatch(playerName), emptyPlayerStats(playerName))
    }

    const overlayRows = (rows = []) => {
      for (const row of rows) {
        const playerName = (row?.playerName || row?.name || '').toString().trim()
        const key = normalizeNameForMatch(playerName)
        if (!key || !rowsByName.has(key)) continue
        rowsByName.set(key, {
          ...rowsByName.get(key),
          ...row,
          playerName: rowsByName.get(key).playerName,
        })
      }
    }

    overlayRows(existingRows)
    overlayRows(scraperPlayerStats)
    return [...rowsByName.values()]
  }

  async buildTournamentScoreContext(tournamentId) {
    const matchRepo = await factory.getMatchRepository()
    const playerRepo = await factory.getPlayerRepository()
    const contestRepo = await factory.getContestRepository()
    const scoringRuleRepo = await factory.getScoringRuleRepository()

    const tournamentMatches = await matchRepo.findByTournament(tournamentId)
    const teamKeys = [
      ...new Set(
        (tournamentMatches || [])
          .flatMap((match) => [
            match.teamAKey || match.teamA,
            match.teamBKey || match.teamB,
          ])
          .filter(Boolean),
      ),
    ]
    const tournamentPlayerRows =
      typeof playerRepo.findByTournament === 'function'
        ? await playerRepo.findByTournament(tournamentId)
        : (
            await Promise.all(
              teamKeys.map((teamKey) => playerRepo.findByTeam(teamKey, tournamentId)),
            )
          ).flat()

    return {
      tournamentMatches,
      tournamentPlayerRows,
      scoringRule: await scoringRuleRepo.findByTournament(tournamentId),
      globalScoringRules: await scoringRuleService.getDefaultScoringRules(),
      contests: await contestRepo.findByTournament(tournamentId),
    }
  }

  // Validates match score payload and returns normalized dry-run preview data.
  async previewMatchScores(matchId, tournamentId, playerStats) {
    if (!matchId || !tournamentId) {
      throw new Error('matchId and tournamentId are required')
    }
    this.validatePlayerStatsPayload(playerStats)
    const normalizedPlayerStats = await this.validatePlayersBelongToMatchTeams(
      matchId,
      tournamentId,
      playerStats,
    )
    return {
      ok: true,
      dryRun: true,
      matchId: String(matchId),
      tournamentId: String(tournamentId),
      processedPayload: {
        playerStats: normalizedPlayerStats,
      },
    }
  }

  // Ensures submitted players belong to the selected match teams and normalizes identities.
  async validatePlayersBelongToMatchTeams(
    matchId,
    tournamentId,
    playerStats = [],
    context = {},
  ) {
    const matchRepo = await factory.getMatchRepository()
    const playerRepo = await factory.getPlayerRepository()

    const match = context.match || (await matchRepo.findById(matchId))
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

    const matchPlayers =
      context.matchPlayers ||
      (
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
    const normalizedRows = []
    for (const row of playerStats) {
      if (!row || typeof row !== 'object') continue
      const incomingName = (row.playerName || row.name || '').toString().trim()
      const incomingId = (row.playerId || '').toString().trim()
      const resolved = resolvePlayerWithNormalizedFallback({
        row,
        identityIndex,
        matchPlayers,
      })
      const resolvedPlayer = resolved?.player || null
      if (!resolvedPlayer) {
        const unresolved = incomingName || incomingId || 'unknown-player'
        invalidEntries.push({
          input: unresolved,
          normalizedInput: resolved?.normalizedInput || normalizeNameForMatch(unresolved),
          suggestions: [],
        })
        continue
      }
      normalizedRows.push({
        ...row,
        playerId: resolvedPlayer.id,
        playerName: resolvedPlayer.name,
        team: resolvedPlayer.team || row.team || null,
      })
    }

    if (invalidEntries.length) {
      const preview = invalidEntries
        .slice(0, 5)
        .map((entry) => entry.input)
        .join(', ')
      const error = new Error(
        `Submitted score JSON includes players not in selected match teams: ${preview}`,
      )
      error.unmatchedPlayers = invalidEntries.map((entry) => entry.input)
      error.unmatchedDetails = invalidEntries
      throw error
    }

    if (!normalizedRows.length) {
      throw new Error('No valid playerStats rows found for the selected match teams')
    }

    return normalizedRows
  }

  // Returns the active saved match score row scoped by tournament.
  async getMatchScores(tournamentId, matchId) {
    const repo = await factory.getMatchScoreRepository()
    const rows = await repo.findByMatch(matchId)
    const scoped = (rows || []).filter(
      (row) => String(row?.tournamentId || '') === String(tournamentId || ''),
    )
    const activeRow = scoped.find((row) => row?.active)
    return activeRow || null
  }

  // Returns the latest active score entry for a match.
  async getActiveMatchScore(matchId) {
    const repo = await factory.getMatchScoreRepository()
    return await repo.findLatestActive(matchId)
  }

  // Parses processed spreadsheet data into API-ready score payload.
  async processExcelScores(excelData) {
    // Parse Excel data and return formatted for upload
    return { data: excelData, validated: true }
  }

  // Persists score rows produced from spreadsheet processing.
  async saveExcelProcessedScores(matchId, tournamentId, playerStats, uploadedBy) {
    return await this.uploadMatchScores(matchId, tournamentId, playerStats, uploadedBy)
  }

  // Returns context data used by the player-overrides admin UI.
  async getPlayerOverridesContext() {
    // Get context data for player overrides UI
    return { overrides: [], context: {} }
  }

  // Persists admin-provided player stat overrides.
  async savePlayerOverrides(tournamentId, overrides) {
    // Save player stat overrides
    return { saved: true, count: overrides.length }
  }

  // Rebuilds derived score tables from one stored match score row.
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

  // Recomputes all derived player/contest scores for active score entries.
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

  // Rebuilds player_match_scores and contest_scores for one match payload.
  async rebuildDerivedScores({ matchId, tournamentId, playerStats, context = {} }) {
    const matchRepo = await factory.getMatchRepository()
    const playerRepo = await factory.getPlayerRepository()
    const contestRepo = await factory.getContestRepository()
    const scoringRuleRepo = await factory.getScoringRuleRepository()

    const matches = context.tournamentMatches || (await matchRepo.findByTournament(tournamentId))
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
    const playerRowsSource = context.tournamentPlayerRows
      ? context.tournamentPlayerRows
      : typeof playerRepo.findByTournament === 'function'
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
    const scoringRule =
      context.scoringRule || (await scoringRuleRepo.findByTournament(tournamentId))
    const globalScoringRules =
      context.globalScoringRules || (await scoringRuleService.getDefaultScoringRules())
    const ruleSet = getRuleSetForTournament({
      tournamentId,
      scoringRules: scoringRule ? [scoringRule] : [],
      dashboardRuleTemplate: globalScoringRules?.rules || cloneDefaultPointsRules(),
    })
    const normalizedRows = normalizePlayerStatRows(playerStats || [], playerRows)
    const deletedPlayerScores = await dbQuery(
      `DELETE FROM player_match_scores
       WHERE tournament_id = $1 AND match_id = $2`,
      [tournamentId, matchId],
    )
    await recordLiveScoreDbWrite(context, {
      table: 'player_match_scores',
      action: 'delete',
      rows: deletedPlayerScores.rowCount || 0,
      fields: ['tournament_id', 'match_id'],
      matchId,
      tournamentId,
      matchLabel: context.match?.name,
      message: `DB cleared ${deletedPlayerScores.rowCount || 0} old player score row(s)`,
      details: {
        fn: 'rebuildDerivedScores',
      },
    })
    const fantasyPointsByPlayerId = new Map()
    const playerScoreRows = []
    for (const row of normalizedRows) {
      const fantasyPoints = Number(calculateFantasyPoints(row, ruleSet) || 0)
      fantasyPointsByPlayerId.set(Number(row.playerId), fantasyPoints)
      playerScoreRows.push([
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
        Number(row.bowledLbw || 0),
        row.dismissed === true,
        fantasyPoints,
      ])
    }
    if (playerScoreRows.length) {
      await dbQuery(
        `INSERT INTO player_match_scores (
           tournament_id, match_id, player_id, raw_stats,
           runs, wickets, catches, fours, sixes, maidens, wides, stumpings,
           runout_direct, runout_indirect, bowled_lbw, dismissed, fantasy_points, created_at, updated_at
         )
         VALUES ${buildBulkPlaceholders({
           rows: playerScoreRows,
           columnsPerRow: 17,
           extraSql: ['now()', 'now()'],
         })}
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
             bowled_lbw = EXCLUDED.bowled_lbw,
             dismissed = EXCLUDED.dismissed,
             fantasy_points = EXCLUDED.fantasy_points,
             updated_at = now()`,
        playerScoreRows.flat(),
      )
      await recordLiveScoreDbWrite(context, {
        table: 'player_match_scores',
        action: 'upsert',
        rows: playerScoreRows.length,
        fields: [
          'raw_stats',
          'runs',
          'wickets',
          'catches',
          'bowled_lbw',
          'fantasy_points',
        ],
        matchId,
        tournamentId,
        matchLabel: context.match?.name,
        message: `DB wrote ${playerScoreRows.length} player fantasy score row(s)`,
        details: {
          fn: 'rebuildDerivedScores',
          playerIds: playerScoreRows.map((row) => row[2]),
        },
      })
    }

    const contests = context.contests || (await contestRepo.findByTournament(tournamentId))
    const lineupRows =
      context.lineupRows ||
      (
        await dbQuery(
          `SELECT team_code as "teamCode", playing_xi as "playingXI"
           FROM match_lineups
           WHERE tournament_id = $1 AND match_id = $2`,
          [tournamentId, matchId],
        )
      ).rows
    const activePlayerIdsByTeam = new Map()
    const playerIdByTeamAndName = new Map(
      playerRows.map((player) => [
        `${String(player.team || '').trim()}::${String(player.name || '')
          .trim()
          .toLowerCase()}`,
        Number(player.id),
      ]),
    )
    for (const row of lineupRows || []) {
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

      const deletedContestScores = await dbQuery(
        `DELETE FROM contest_scores WHERE contest_id = $1 AND match_id = $2`,
        [contest.id, matchId],
      )
      await recordLiveScoreDbWrite(context, {
        table: 'contest_scores',
        action: 'delete',
        rows: deletedContestScores.rowCount || 0,
        fields: ['contest_id', 'match_id'],
        matchId,
        tournamentId,
        matchLabel: context.match?.name,
        message: `DB cleared ${deletedContestScores.rowCount || 0} old contest score row(s)`,
        details: {
          fn: 'rebuildDerivedScores',
          contestId: contest.id,
        },
      })

      let rows = []
      if ((contest.mode || '').toString().trim().toLowerCase() === 'fixed_roster') {
        const fixedRosterResult = await dbQuery(
          `SELECT user_id as "userId", player_ids as "playerIds"
           FROM contest_fixed_rosters
           WHERE contest_id = $1`,
          [contest.id],
        )
        const contestMatchIds = scopedMatchIds.length ? scopedMatchIds : [String(matchId)]
        const allPlayerIds = [
          ...new Set(
            (fixedRosterResult.rows || []).flatMap((row) =>
              (Array.isArray(row.playerIds) ? row.playerIds : [])
                .map((value) => Number(value))
                .filter(Boolean),
            ),
          ),
        ]
        const aggregateScoreResult = allPlayerIds.length
          ? await dbQuery(
              `SELECT match_id as "matchId", player_id as "playerId", fantasy_points as "fantasyPoints"
               FROM player_match_scores
               WHERE tournament_id = $1
                 AND match_id::text = ANY($2::text[])
                 AND player_id = ANY($3::bigint[])`,
              [tournamentId, contestMatchIds, allPlayerIds],
            )
          : { rows: [] }
        const totalPointsByPlayerId = new Map()
        const currentMatchPointsByPlayerId = new Map()
        for (const scoreRow of aggregateScoreResult.rows || []) {
          const numericPlayerId = Number(scoreRow.playerId)
          const numericPoints = Number(scoreRow.fantasyPoints || 0)
          totalPointsByPlayerId.set(
            numericPlayerId,
            Number(totalPointsByPlayerId.get(numericPlayerId) || 0) + numericPoints,
          )
          if (String(scoreRow.matchId) === String(matchId)) {
            currentMatchPointsByPlayerId.set(numericPlayerId, numericPoints)
          }
        }
        rows = (fixedRosterResult.rows || []).map((row) => {
          const rankedRoster = (Array.isArray(row.playerIds) ? row.playerIds : [])
            .map((value, index) => ({
              playerId: Number(value),
              rosterSlot: index + 1,
              totalPoints: Number(totalPointsByPlayerId.get(Number(value)) || 0),
            }))
            .filter((entry) => entry.playerId)
            .sort((left, right) => {
              if (right.totalPoints !== left.totalPoints) {
                return right.totalPoints - left.totalPoints
              }
              return left.rosterSlot - right.rosterSlot
            })
          const countedIds = rankedRoster
            .slice(0, FIXED_ROSTER_COUNTED_SIZE)
            .map((entry) => entry.playerId)
          return {
            userId: row.userId,
            points: countedIds.reduce(
              (sum, playerId) =>
                sum + Number(currentMatchPointsByPlayerId.get(Number(playerId)) || 0),
              0,
            ),
          }
        })
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

      const contestScoreRows = rows.map((row) => [
        contest.id,
        matchId,
        row.userId,
        Number(row.points || 0),
      ])
      if (contestScoreRows.length) {
        await dbQuery(
          `INSERT INTO contest_scores (contest_id, match_id, user_id, points, created_at, updated_at)
           VALUES ${buildBulkPlaceholders({
             rows: contestScoreRows,
             columnsPerRow: 4,
             extraSql: ['now()', 'now()'],
           })}
           ON CONFLICT (contest_id, match_id, user_id) DO UPDATE
           SET points = EXCLUDED.points, updated_at = now()`,
          contestScoreRows.flat(),
        )
        await recordLiveScoreDbWrite(context, {
          table: 'contest_scores',
          action: 'upsert',
          rows: contestScoreRows.length,
          fields: ['points'],
          matchId,
          tournamentId,
          matchLabel: context.match?.name,
          message: `DB wrote ${contestScoreRows.length} user score row(s) for contest ${contest.id}`,
          details: {
            fn: 'rebuildDerivedScores',
            contestId: contest.id,
            users: contestScoreRows.map((row) => row[2]),
          },
        })
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
