import { createRepositoryFactory } from '../repositories/repository.factory.js'
import { dbQuery } from '../db.js'
import matchService from './match.service.js'
import { mapMatchWithDerivedStatus } from './tournamentImport.service.js'

const factory = createRepositoryFactory()

class TeamSelectionService {
  // Detects unique-constraint conflicts for duplicate team selections.
  isDuplicateSelectionError(error) {
    const message = (error?.message || '').toString()
    return (
      error?.code === '23505' &&
      (message.includes('team_selections_match_id_user_id_key') ||
        message.includes('idx_team_selections_contest_match_user'))
    )
  }

  // Creates or updates a user's team selection for a match/contest with validation.
  async saveTeamSelection(
    matchId,
    userId,
    playingXi,
    backups,
    contestId = null,
    captainId = null,
    viceCaptainId = null,
    options = {},
  ) {
    // Validate match exists
    const match = await matchService.getMatch(matchId)
    if (!match) throw new Error('Match not found')
    const resolvedMatch = mapMatchWithDerivedStatus(match)
    const allowLockedEdit = Boolean(options?.allowLockedEdit)
    if (resolvedMatch.status !== 'notstarted' && !allowLockedEdit) {
      const error = new Error('Match is locked. Teams cannot be edited after start time.')
      error.statusCode = 403
      throw error
    }

    const normalizedCaptainId =
      captainId == null || captainId === '' ? null : Number(captainId)
    const normalizedViceCaptainId =
      viceCaptainId == null || viceCaptainId === '' ? null : Number(viceCaptainId)
    const normalizedPlayingXi = Array.isArray(playingXi)
      ? playingXi.map(Number).filter(Boolean)
      : []
    const normalizedBackups = Array.isArray(backups)
      ? backups.map(Number).filter(Boolean)
      : []
    if (normalizedCaptainId && !normalizedPlayingXi.includes(normalizedCaptainId)) {
      throw new Error('Captain must be part of playing XI')
    }
    if (
      normalizedViceCaptainId &&
      !normalizedPlayingXi.includes(normalizedViceCaptainId)
    ) {
      throw new Error('Vice captain must be part of playing XI')
    }
    if (
      normalizedCaptainId &&
      normalizedViceCaptainId &&
      normalizedCaptainId === normalizedViceCaptainId
    ) {
      throw new Error('Captain and vice captain cannot be the same player')
    }

    const repo = await factory.getTeamSelectionRepository()
    // Selections are contest-scoped. Do not reuse another contest's row for the same match.
    const existing = await repo.findByMatchAndUser(matchId, userId, contestId)
    if (existing) {
      const saved = await repo.update(existing.id, {
        contestId: contestId || existing.contestId || null,
        captainId: normalizedCaptainId,
        viceCaptainId: normalizedViceCaptainId,
        playingXi: normalizedPlayingXi,
        backups: normalizedBackups,
      })
      await this.syncContestMatchPlayers({
        contestId,
        match: resolvedMatch,
        userId,
        playingXi: normalizedPlayingXi,
      })
      return saved
    }
    let saved
    try {
      saved = await repo.create({
        contestId,
        matchId,
        userId,
        captainId: normalizedCaptainId,
        viceCaptainId: normalizedViceCaptainId,
        playingXi: normalizedPlayingXi,
        backups: normalizedBackups,
      })
    } catch (error) {
      if (!this.isDuplicateSelectionError(error)) {
        throw error
      }
      const conflictError = new Error(
        contestId
          ? 'A saved team already exists for this user and match in another contest row. Apply the latest migration and retry.'
          : 'A team selection already exists for this match and user. Please retry to update your saved team.',
      )
      conflictError.statusCode = 409
      throw conflictError
    }
    await this.syncContestMatchPlayers({
      contestId,
      match: resolvedMatch,
      userId,
      playingXi: normalizedPlayingXi,
    })
    return saved
  }

  // Returns one saved team selection for a user in a match.
  async getUserTeamSelection(matchId, userId, contestId = null) {
    const repo = await factory.getTeamSelectionRepository()
    return await repo.findByMatchAndUser(matchId, userId, contestId)
  }

  // Returns all saved team selections for a match.
  async getMatchTeamSelections(matchId, contestId = null) {
    const repo = await factory.getTeamSelectionRepository()
    return await repo.findByMatch(matchId, contestId)
  }

  // Returns a user's picks for a specific match and optional contest scope.
  async getUserPicksByMatch(userId, matchId, contestId = null) {
    const repo = await factory.getTeamSelectionRepository()
    return await repo.findByMatchAndUser(matchId, userId, contestId)
  }

  async getCopySources({ matchId, userId, targetContestId }) {
    const result = await dbQuery(
      `SELECT ts.id, ts.contest_id as "contestId", ts.match_id as "matchId",
              ts.user_id as "userId", ts.captain_id as "captainId",
              ts.vice_captain_id as "viceCaptainId", ts.playing_xi as "playingXi",
              ts.backups, ts.updated_at as "updatedAt", c.name as "contestName"
       FROM team_selections ts
       LEFT JOIN contests c ON c.id = ts.contest_id
       WHERE ts.match_id = $1
         AND ts.user_id = $2
         AND ts.contest_id IS NOT NULL
         AND ts.contest_id <> $3
       ORDER BY ts.updated_at DESC`,
      [matchId, userId, targetContestId],
    )
    return (result.rows || []).map((row) => ({
      ...row,
      playingXi:
        typeof row.playingXi === 'string' ? JSON.parse(row.playingXi) : row.playingXi,
      backups: typeof row.backups === 'string' ? JSON.parse(row.backups) : row.backups,
    }))
  }

  async copyTeamSelection({
    sourceSelectionId,
    targetContestId,
    matchId,
    userId,
    options = {},
  }) {
    const repo = await factory.getTeamSelectionRepository()
    const source = await repo.findById(sourceSelectionId)
    if (!source) {
      const error = new Error('Source team not found')
      error.statusCode = 404
      throw error
    }
    if (String(source.userId) !== String(userId) || String(source.matchId) !== String(matchId)) {
      const error = new Error('Source team does not match this user and match')
      error.statusCode = 400
      throw error
    }
    if (String(source.contestId || '') === String(targetContestId || '')) {
      const error = new Error('Source and target contest cannot be the same')
      error.statusCode = 400
      throw error
    }
    return this.saveTeamSelection(
      matchId,
      userId,
      source.playingXi || [],
      source.backups || [],
      targetContestId,
      source.captainId || null,
      source.viceCaptainId || null,
      options,
    )
  }

  // Syncs contest_match_players rows from the latest saved playing XI.
  async syncContestMatchPlayers({ contestId, match, userId, playingXi }) {
    if (!contestId || !match?.tournamentId || !match?.id || !userId) return
    const contestRepo = await factory.getContestRepository()
    const contest = await contestRepo.findById(contestId)
    if (!contest) return

    await dbQuery(
      `DELETE FROM contest_match_players
       WHERE contest_id = $1 AND match_id = $2 AND user_id = $3`,
      [contestId, match.id, userId],
    )
    const playerIds = Array.isArray(playingXi)
      ? playingXi.map(Number).filter(Boolean)
      : []
    if (!playerIds.length) return
    const values = []
    const placeholders = playerIds
      .map((playerId, index) => {
        const offset = index * 5
        values.push(match.tournamentId, contestId, match.id, userId, playerId)
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, 'selection', now(), now())`
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

export default new TeamSelectionService()
