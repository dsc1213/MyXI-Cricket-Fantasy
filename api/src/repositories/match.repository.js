import { dbQuery } from '../db.js'

class MatchRepository {
  async findAll() {
    const result = await dbQuery(
      `SELECT id, tournament_id as "tournamentId", name, team_a as "teamA", team_b as "teamB",
              team_a_key as "teamAKey", team_b_key as "teamBKey",
              start_time as "startTime", status, created_at as "createdAt", updated_at as "updatedAt"
       FROM matches
       ORDER BY start_time ASC`,
    )
    return result.rows
  }

  async findById(id) {
    const result = await dbQuery(
      `SELECT id, tournament_id as "tournamentId", name, team_a as "teamA", team_b as "teamB",
              team_a_key as "teamAKey", team_b_key as "teamBKey",
              start_time as "startTime", status, created_at as "createdAt", updated_at as "updatedAt"
       FROM matches
       WHERE id = $1`,
      [id],
    )
    return result.rows[0]
  }

  async findByTournament(tournamentId) {
    const result = await dbQuery(
      `SELECT id, tournament_id as "tournamentId", name, team_a as "teamA", team_b as "teamB",
              team_a_key as "teamAKey", team_b_key as "teamBKey",
              start_time as "startTime", status, created_at as "createdAt", updated_at as "updatedAt"
       FROM matches
       WHERE tournament_id = $1
       ORDER BY start_time ASC`,
      [tournamentId],
    )
    return result.rows
  }

  async create(data) {
    const { tournamentId, name, teamA, teamB, teamAKey, teamBKey, startTime, status } =
      data
    const result = await dbQuery(
      `INSERT INTO matches (tournament_id, name, team_a, team_b, team_a_key, team_b_key, start_time, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
       RETURNING id, tournament_id as "tournamentId", name, team_a as "teamA", team_b as "teamB",
                 team_a_key as "teamAKey", team_b_key as "teamBKey",
                 start_time as "startTime", status, created_at as "createdAt", updated_at as "updatedAt"`,
      [
        tournamentId,
        name,
        teamA,
        teamB,
        teamAKey,
        teamBKey,
        startTime,
        status || 'scheduled',
      ],
    )
    return result.rows[0]
  }

  async bulkCreate(matches) {
    const values = []
    let paramIndex = 1
    const placeholders = matches
      .map((m) => {
        values.push(
          m.tournamentId,
          m.name,
          m.teamA,
          m.teamB,
          m.teamAKey,
          m.teamBKey,
          m.startTime,
          m.status || 'scheduled',
        )
        const p1 = paramIndex,
          p2 = paramIndex + 1,
          p3 = paramIndex + 2,
          p4 = paramIndex + 3,
          p5 = paramIndex + 4,
          p6 = paramIndex + 5,
          p7 = paramIndex + 6,
          p8 = paramIndex + 7
        paramIndex += 8
        return `($${p1}, $${p2}, $${p3}, $${p4}, $${p5}, $${p6}, $${p7}, $${p8}, now(), now())`
      })
      .join(', ')

    const result = await dbQuery(
      `INSERT INTO matches (tournament_id, name, team_a, team_b, team_a_key, team_b_key, start_time, status, created_at, updated_at)
       VALUES ${placeholders}
       RETURNING id, tournament_id as "tournamentId", name, team_a as "teamA", team_b as "teamB",
                 team_a_key as "teamAKey", team_b_key as "teamBKey",
                 start_time as "startTime", status, created_at as "createdAt", updated_at as "updatedAt"`,
      values,
    )
    return result.rows
  }

  async updateStatus(id, status) {
    const result = await dbQuery(
      `UPDATE matches
       SET status = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, tournament_id as "tournamentId", name, team_a as "teamA", team_b as "teamB",
                 team_a_key as "teamAKey", team_b_key as "teamBKey",
                 start_time as "startTime", status, created_at as "createdAt", updated_at as "updatedAt"`,
      [status, id],
    )
    return result.rows[0]
  }

  async delete(id) {
    const result = await dbQuery(
      `DELETE FROM matches WHERE id = $1
       RETURNING id`,
      [id],
    )
    return result.rows.length > 0
  }
}

export default new MatchRepository()
