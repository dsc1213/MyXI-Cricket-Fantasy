import { dbQuery } from '../db.js'

class TeamSelectionRepository {
  async findByMatchAndUser(matchId, userId, contestId = null) {
    const hasContest = contestId !== null && contestId !== undefined && contestId !== ''
    const result = await dbQuery(
      `SELECT id, contest_id as "contestId", match_id as "matchId", user_id as "userId",
              captain_id as "captainId", vice_captain_id as "viceCaptainId",
              playing_xi as "playingXi", backups, created_at as "createdAt", updated_at as "updatedAt"
       FROM team_selections
       WHERE match_id = $1 AND user_id = $2
         AND (${hasContest ? 'contest_id = $3' : 'contest_id is null'})
       ORDER BY updated_at DESC
       LIMIT 1`,
      hasContest ? [matchId, userId, contestId] : [matchId, userId],
    )
    return result.rows[0]
  }

  async findByMatch(matchId, contestId = null) {
    const hasContest = contestId !== null && contestId !== undefined && contestId !== ''
    const result = await dbQuery(
      `SELECT id, contest_id as "contestId", match_id as "matchId", user_id as "userId",
              captain_id as "captainId", vice_captain_id as "viceCaptainId",
              playing_xi as "playingXi", backups, created_at as "createdAt", updated_at as "updatedAt"
       FROM team_selections
       WHERE match_id = $1
         AND (${hasContest ? 'contest_id = $2' : 'contest_id is null'})`,
      hasContest ? [matchId, contestId] : [matchId],
    )
    return result.rows
  }

  async findByUser(userId) {
    const result = await dbQuery(
      `SELECT id, contest_id as "contestId", match_id as "matchId", user_id as "userId",
              captain_id as "captainId", vice_captain_id as "viceCaptainId",
              playing_xi as "playingXi", backups, created_at as "createdAt", updated_at as "updatedAt"
       FROM team_selections
       WHERE user_id = $1`,
      [userId],
    )
    return result.rows
  }

  async create(data) {
    const { contestId, matchId, userId, captainId, viceCaptainId, playingXi, backups } = data
    const result = await dbQuery(
      `INSERT INTO team_selections (
         contest_id, match_id, user_id, captain_id, vice_captain_id, playing_xi, backups, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
       RETURNING id, contest_id as "contestId", match_id as "matchId", user_id as "userId",
                 captain_id as "captainId", vice_captain_id as "viceCaptainId",
                 playing_xi as "playingXi", backups, created_at as "createdAt", updated_at as "updatedAt"`,
      [
        contestId || null,
        matchId,
        userId,
        captainId || null,
        viceCaptainId || null,
        Array.isArray(playingXi) ? playingXi.map((value) => Number(value)) : [],
        Array.isArray(backups) ? backups.map((value) => Number(value)) : [],
      ],
    )
    const row = result.rows[0]
    if (row) {
      return {
        ...row,
        playingXi:
          typeof row.playingXi === 'string' ? JSON.parse(row.playingXi) : row.playingXi,
        backups: typeof row.backups === 'string' ? JSON.parse(row.backups) : row.backups,
      }
    }
    return row
  }

  async update(id, data) {
    const { playingXi, backups, captainId, viceCaptainId } = data
    const result = await dbQuery(
      `UPDATE team_selections
       SET captain_id = $1, vice_captain_id = $2, playing_xi = $3, backups = $4, updated_at = now()
       WHERE id = $5
       RETURNING id, contest_id as "contestId", match_id as "matchId", user_id as "userId",
                 captain_id as "captainId", vice_captain_id as "viceCaptainId",
                 playing_xi as "playingXi", backups, created_at as "createdAt", updated_at as "updatedAt"`,
      [
        captainId || null,
        viceCaptainId || null,
        Array.isArray(playingXi) ? playingXi.map((value) => Number(value)) : [],
        Array.isArray(backups) ? backups.map((value) => Number(value)) : [],
        id,
      ],
    )
    const row = result.rows[0]
    if (row) {
      return {
        ...row,
        playingXi:
          typeof row.playingXi === 'string' ? JSON.parse(row.playingXi) : row.playingXi,
        backups: typeof row.backups === 'string' ? JSON.parse(row.backups) : row.backups,
      }
    }
    return row
  }

  async delete(id) {
    const result = await dbQuery(
      `DELETE FROM team_selections WHERE id = $1
       RETURNING id`,
      [id],
    )
    return result.rows.length > 0
  }
}

export default new TeamSelectionRepository()
