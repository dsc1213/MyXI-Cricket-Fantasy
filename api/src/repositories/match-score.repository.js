import { dbQuery } from '../db.js'

class MatchScoreRepository {
  async findByMatch(matchId) {
    const result = await dbQuery(
      `SELECT id, match_id as "matchId", tournament_id as "tournamentId", player_stats as "playerStats",
              uploaded_by as "uploadedBy", active, created_at as "createdAt", updated_at as "updatedAt"
       FROM match_scores
       WHERE match_id = $1
       ORDER BY created_at DESC`,
      [matchId],
    )
    return result.rows.map((row) => ({
      ...row,
      playerStats:
        typeof row.playerStats === 'string'
          ? JSON.parse(row.playerStats)
          : row.playerStats,
    }))
  }

  async findLatestActive(matchId) {
    const result = await dbQuery(
      `SELECT id, match_id as "matchId", tournament_id as "tournamentId", player_stats as "playerStats",
              uploaded_by as "uploadedBy", active, created_at as "createdAt", updated_at as "updatedAt"
       FROM match_scores
       WHERE match_id = $1 AND active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [matchId],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      ...row,
      playerStats:
        typeof row.playerStats === 'string'
          ? JSON.parse(row.playerStats)
          : row.playerStats,
    }
  }

  async findById(id) {
    const result = await dbQuery(
      `SELECT id, match_id as "matchId", tournament_id as "tournamentId", player_stats as "playerStats",
              uploaded_by as "uploadedBy", active, created_at as "createdAt", updated_at as "updatedAt"
       FROM match_scores
       WHERE id = $1`,
      [id],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      ...row,
      playerStats:
        typeof row.playerStats === 'string'
          ? JSON.parse(row.playerStats)
          : row.playerStats,
    }
  }

  async create(data) {
    const { matchId, tournamentId, playerStats, uploadedBy } = data
    const payloadJson = JSON.stringify(playerStats)

    const updated = await dbQuery(
      `WITH target AS (
         SELECT id
         FROM match_scores
         WHERE tournament_id = $1 AND match_id = $2
         ORDER BY updated_at DESC, id DESC
         LIMIT 1
       )
       UPDATE match_scores ms
       SET player_stats = $3,
           uploaded_by = $4,
           active = true,
           updated_at = now()
       FROM target
       WHERE ms.id = target.id
       RETURNING ms.id, ms.match_id as "matchId", ms.tournament_id as "tournamentId",
                 ms.player_stats as "playerStats", ms.uploaded_by as "uploadedBy",
                 ms.active, ms.created_at as "createdAt", ms.updated_at as "updatedAt"`,
      [tournamentId, matchId, payloadJson, uploadedBy || null],
    )

    const result = updated.rows[0]
      ? updated
      : await dbQuery(
          `INSERT INTO match_scores (match_id, tournament_id, player_stats, uploaded_by, active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, now(), now())
             RETURNING id, match_id as "matchId", tournament_id as "tournamentId", player_stats as "playerStats",
                       uploaded_by as "uploadedBy", active, created_at as "createdAt", updated_at as "updatedAt"`,
          [matchId, tournamentId, payloadJson, uploadedBy || null],
        )

    const row = result.rows[0]
    return {
      ...row,
      playerStats:
        typeof row.playerStats === 'string'
          ? JSON.parse(row.playerStats)
          : row.playerStats,
    }
  }

  async deactivatePrevious(matchId) {
    await dbQuery(
      `UPDATE match_scores
       SET active = false, updated_at = now()
       WHERE match_id = $1 AND active = true`,
      [matchId],
    )
  }

  async update(id, data) {
    const { playerStats, active } = data
    const updates = []
    const values = []
    let paramIndex = 1

    if (playerStats !== undefined) {
      updates.push(`player_stats = $${paramIndex++}`)
      values.push(JSON.stringify(playerStats))
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex++}`)
      values.push(active)
    }
    if (updates.length === 0) return this.findById(id)

    updates.push(`updated_at = now()`)
    values.push(id)

    const result = await dbQuery(
      `UPDATE match_scores
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, match_id as "matchId", tournament_id as "tournamentId", player_stats as "playerStats",
                 uploaded_by as "uploadedBy", active, created_at as "createdAt", updated_at as "updatedAt"`,
      values,
    )
    const row = result.rows[0]
    return {
      ...row,
      playerStats:
        typeof row.playerStats === 'string'
          ? JSON.parse(row.playerStats)
          : row.playerStats,
    }
  }

  async delete(id) {
    const result = await dbQuery(
      `DELETE FROM match_scores WHERE id = $1
       RETURNING id`,
      [id],
    )
    return result.rows.length > 0
  }
}

export default new MatchScoreRepository()
