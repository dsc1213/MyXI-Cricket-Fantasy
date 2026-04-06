import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import { resolveEffectiveSelection } from '../scoring.js'
import { normalizeMatchStatus } from './tournamentImport.service.js'

const factory = createRepositoryFactory()

const toIdArray = (value) => {
  const rows = typeof value === 'string' ? JSON.parse(value) : value
  return Array.isArray(rows) ? rows.map((item) => Number(item)).filter(Boolean) : []
}

const toNameArray = (value) => {
  const rows = typeof value === 'string' ? JSON.parse(value) : value
  return Array.isArray(rows)
    ? rows.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

class MatchService {
  async getMatch(id) {
    const repo = await factory.getMatchRepository()
    return await repo.findById(id)
  }

  async getMatchesByTournament(tournamentId) {
    const repo = await factory.getMatchRepository()
    return await repo.findByTournament(tournamentId)
  }

  async importFixtures(tournamentId, fixtures) {
    // fixtures: array of { name, teamA, teamB, teamAKey, teamBKey, startTime, status }
    const repo = await factory.getMatchRepository()
    const matchData = fixtures.map((f) => ({
      ...f,
      tournamentId,
    }))
    return await repo.bulkCreate(matchData)
  }

  async updateMatchStatus(id, status) {
    const repo = await factory.getMatchRepository()
    const previous = await repo.findById(id)
    const updated = await repo.updateStatus(id, status)
    if (!updated) return updated

    const movedToInProgress =
      normalizeMatchStatus(previous?.status) === 'notstarted' &&
      normalizeMatchStatus(updated?.status) === 'inprogress'

    if (!movedToInProgress) {
      return updated
    }

    const replacement = await this.applyBackupReplacementOnMatchStart(updated)
    return {
      ...updated,
      autoReplacement: replacement,
    }
  }

  async forceApplyBackupReplacement(matchId) {
    const match = await this.getMatch(matchId)
    if (!match) {
      const error = new Error('Match not found')
      error.statusCode = 404
      throw error
    }
    const replacement = await this.applyBackupReplacementOnMatchStart(match)
    return {
      matchId: match.id,
      tournamentId: match.tournamentId,
      autoReplacement: replacement,
    }
  }

  async applyBackupReplacementOnMatchStart(match) {
    const tournamentId = match?.tournamentId
    const matchId = match?.id
    if (!tournamentId || !matchId) {
      return { updatedSelections: 0, skippedSelections: 0 }
    }

    const lineupResult = await dbQuery(
      `SELECT team_code as "teamCode", playing_xi as "playingXI"
       FROM match_lineups
       WHERE tournament_id = $1 AND match_id = $2`,
      [tournamentId, matchId],
    )

    const playerResult = await dbQuery(
      `SELECT tp.team_code as "teamCode", p.id, p.display_name as "displayName"
       FROM tournament_players tp
       JOIN players p ON p.id = tp.player_id
       WHERE tp.tournament_id = $1`,
      [tournamentId],
    )

    const playerIdByTeamAndName = new Map(
      (playerResult.rows || []).map((row) => [
        `${String(row.teamCode || '')
          .trim()
          .toUpperCase()}::${String(row.displayName || '')
          .trim()
          .toLowerCase()}`,
        Number(row.id),
      ]),
    )

    const activePlayerIds = []
    for (const row of lineupResult.rows || []) {
      const teamCode = String(row.teamCode || '')
        .trim()
        .toUpperCase()
      const names = toNameArray(row.playingXI)
      for (const name of names) {
        const key = `${teamCode}::${name.toLowerCase()}`
        const playerId = playerIdByTeamAndName.get(key)
        if (playerId) activePlayerIds.push(playerId)
      }
    }

    const normalizedActiveIds = Array.from(
      new Set(activePlayerIds.map(Number).filter(Boolean)),
    )
    if (!normalizedActiveIds.length) {
      return { updatedSelections: 0, skippedSelections: 0 }
    }

    const selectionResult = await dbQuery(
      `SELECT id,
              contest_id as "contestId",
              user_id as "userId",
              captain_id as "captainId",
              vice_captain_id as "viceCaptainId",
              playing_xi as "playingXi",
              backups
       FROM team_selections
       WHERE match_id = $1`,
      [matchId],
    )

    let updatedSelections = 0
    let skippedSelections = 0

    for (const row of selectionResult.rows || []) {
      const currentPlayingXi = toIdArray(row.playingXi)
      const currentBackups = toIdArray(row.backups)
      if (!currentPlayingXi.length) {
        skippedSelections += 1
        continue
      }

      const resolved = resolveEffectiveSelection({
        playingXi: currentPlayingXi,
        backups: currentBackups,
        activePlayerIds: normalizedActiveIds,
        captainId: row.captainId,
        viceCaptainId: row.viceCaptainId,
      })

      const nextPlayingXi = (resolved.effectivePlayerIds || [])
        .map((value) => Number(value))
        .filter(Boolean)

      const nextPlayingSet = new Set(nextPlayingXi)
      const nextBackups = currentBackups.filter(
        (value) => !nextPlayingSet.has(Number(value)),
      )

      const isSamePlayingXi =
        nextPlayingXi.length === currentPlayingXi.length &&
        nextPlayingXi.every(
          (value, index) => Number(currentPlayingXi[index]) === Number(value),
        )
      const isSameBackups =
        nextBackups.length === currentBackups.length &&
        nextBackups.every(
          (value, index) => Number(currentBackups[index]) === Number(value),
        )

      if (isSamePlayingXi && isSameBackups) {
        skippedSelections += 1
        continue
      }

      await dbQuery(
        `UPDATE team_selections
         SET playing_xi = $1,
             backups = $2,
             updated_at = now()
         WHERE id = $3`,
        [nextPlayingXi, nextBackups, row.id],
      )

      if (row.contestId) {
        await dbQuery(
          `DELETE FROM contest_match_players
           WHERE contest_id = $1 AND match_id = $2 AND user_id = $3`,
          [row.contestId, matchId, row.userId],
        )

        if (nextPlayingXi.length) {
          const values = []
          const placeholders = nextPlayingXi
            .map((playerId, index) => {
              const offset = index * 5
              values.push(
                tournamentId,
                row.contestId,
                matchId,
                row.userId,
                Number(playerId),
              )
              return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, 'selection-auto-swap', now(), now())`
            })
            .join(', ')

          await dbQuery(
            `INSERT INTO contest_match_players (
               tournament_id, contest_id, match_id, user_id, player_id, source, created_at, updated_at
             ) VALUES ${placeholders}
             ON CONFLICT (contest_id, match_id, user_id, player_id) DO UPDATE
             SET updated_at = now(), source = EXCLUDED.source`,
            values,
          )
        }
      }

      updatedSelections += 1
    }

    return {
      updatedSelections,
      skippedSelections,
    }
  }

  async uploadScore(matchId, tournamentId, playerStats, uploadedBy) {
    const scoreRepo = await factory.getMatchScoreRepository()
    // Deactivate previous score
    await scoreRepo.deactivatePrevious(matchId)
    // Create new score
    return await scoreRepo.create({
      matchId,
      tournamentId,
      playerStats,
      uploadedBy,
    })
  }

  async getScoreHistory(matchId) {
    const repo = await factory.getMatchScoreRepository()
    return await repo.findByMatch(matchId)
  }

  async rollbackScore(matchId, scoreId) {
    const scoreRepo = await factory.getMatchScoreRepository()
    // Find previous score or mark latest as inactive
    const history = await scoreRepo.findByMatch(matchId)
    if (history.length < 2) return null
    // Deactivate the scoreId, activate the previous one
    await scoreRepo.update(scoreId, { active: false })
    if (history[1]) {
      await scoreRepo.update(history[1].id, { active: true })
    }
    return await scoreRepo.findLatestActive(matchId)
  }

  async autoSwapPlayers(matchId, userId, swaps) {
    // swaps format: { out: playerId, in: playerId }
    // This would update team selection if match is still open
    // Placeholder for complex logic
    return { matchId, userId, swaps, applied: true }
  }
}

export default new MatchService()
