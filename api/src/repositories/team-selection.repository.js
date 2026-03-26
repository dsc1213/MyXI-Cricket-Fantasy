import { dbQuery } from '../db.js'

class TeamSelectionRepository {
  async findByMatchAndUser(matchId, userId) {
    const result = await dbQuery(
      `SELECT id, match_id as "matchId", user_id as "userId", playing_xi as "playingXi", backups, created_at as "createdAt", updated_at as "updatedAt"
       FROM team_selections
       WHERE match_id = $1 AND user_id = $2`,
      [matchId, userId],
    )
    return result.rows[0]
  }

  async findByMatch(matchId) {
    const result = await dbQuery(
      `SELECT id, match_id as "matchId", user_id as "userId", playing_xi as "playingXi", backups, created_at as "createdAt", updated_at as "updatedAt"
       FROM team_selections
       WHERE match_id = $1`,
      [matchId],
    )
    return result.rows
  }

  async findByUser(userId) {
    const result = await dbQuery(
      `SELECT id, match_id as "matchId", user_id as "userId", playing_xi as "playingXi", backups, created_at as "createdAt", updated_at as "updatedAt"
       FROM team_selections
       WHERE user_id = $1`,
      [userId],
    )
    return result.rows
  }

  async create(data) {
    const { matchId, userId, playingXi, backups } = data
    const result = await dbQuery(
      `INSERT INTO team_selections (match_id, user_id, playing_xi, backups, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, match_id as "matchId", user_id as "userId", playing_xi as "playingXi", backups, created_at as "createdAt", updated_at as "updatedAt"`,
      [matchId, userId, JSON.stringify(playingXi || []), JSON.stringify(backups || [])],
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
    const { playingXi, backups } = data
    const result = await dbQuery(
      `UPDATE team_selections
       SET playing_xi = $1, backups = $2, updated_at = now()
       WHERE id = $3
       RETURNING id, match_id as "matchId", user_id as "userId", playing_xi as "playingXi", backups, created_at as "createdAt", updated_at as "updatedAt"`,
      [JSON.stringify(playingXi), JSON.stringify(backups), id],
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
