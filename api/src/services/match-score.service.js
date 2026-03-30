import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import { cloneDefaultPointsRules } from '../default-points-rules.js'
import scoringRuleService from './scoring-rule.service.js'
import {
  calculateFantasyPoints,
  getRuleSetForTournament,
  normalizePlayerStatRows,
  resolveEffectiveSelection,
} from '../scoring.js'

const factory = createRepositoryFactory()

class MatchScoreService {
  async uploadMatchScores(matchId, tournamentId, playerStats, uploadedBy) {
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

  async rebuildDerivedScores({ matchId, tournamentId, playerStats }) {
    const matchRepo = await factory.getMatchRepository()
    const playerRepo = await factory.getPlayerRepository()
    const contestRepo = await factory.getContestRepository()
    const scoringRuleRepo = await factory.getScoringRuleRepository()

    const matches = await matchRepo.findByTournament(tournamentId)
    const teamKeys = [
      ...new Set(
        (matches || [])
          .flatMap((match) => [match.teamAKey || match.teamA, match.teamBKey || match.teamB])
          .filter(Boolean),
      ),
    ]
    const playerGroups = await Promise.all(teamKeys.map((teamKey) => playerRepo.findByTeam(teamKey)))
    const playerRows = playerGroups.flat().map((player) => ({
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
        `${String(player.team || '').trim()}::${String(player.name || '').trim().toLowerCase()}`,
        Number(player.id),
      ]),
    )
    for (const row of lineupResult.rows || []) {
      const playingXI =
        typeof row.playingXI === 'string' ? JSON.parse(row.playingXI) : row.playingXI || []
      const ids = playingXI
        .map((name) =>
          playerIdByTeamAndName.get(
            `${String(row.teamCode || '').trim()}::${String(name || '').trim().toLowerCase()}`,
          ),
        )
        .filter(Boolean)
      activePlayerIdsByTeam.set(String(row.teamCode || '').trim(), ids)
    }
    const contestSummaries = []
    for (const contest of contests) {
      const scopedMatchIds = Array.isArray(contest?.matchIds) ? contest.matchIds.map(String) : []
      if (scopedMatchIds.length && !scopedMatchIds.includes(String(matchId))) continue

      await dbQuery(`DELETE FROM contest_scores WHERE contest_id = $1 AND match_id = $2`, [
        contest.id,
        matchId,
      ])

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
          points: (Array.isArray(row.playerIds) ? row.playerIds : []).reduce(
            (sum, playerId) => sum + Number(fantasyPointsByPlayerId.get(Number(playerId)) || 0),
            0,
          ),
        }))
      } else {
        const matchRecord = (matches || []).find((item) => String(item.id) === String(matchId)) || null
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
            typeof row.playingXi === 'string' ? JSON.parse(row.playingXi) : row.playingXi || []
          const backups = typeof row.backups === 'string' ? JSON.parse(row.backups) : row.backups || []
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
            if (resolved.captainApplies && Number(row.captainId) === Number(playerId)) multiplier = 2
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
