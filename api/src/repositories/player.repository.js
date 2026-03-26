import { dbQuery } from '../db.js'

class PlayerRepository {
  async findAll() {
    const result = await dbQuery(
      `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
              player_id as "playerId", created_at as "createdAt", updated_at as "updatedAt"
       FROM players
       ORDER BY team_key, first_name ASC`,
    )
    return result.rows
  }

  async findById(id) {
    const result = await dbQuery(
      `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
              player_id as "playerId", created_at as "createdAt", updated_at as "updatedAt"
       FROM players
       WHERE id = $1`,
      [id],
    )
    return result.rows[0]
  }

  async findByTeam(teamKey) {
    const result = await dbQuery(
      `SELECT id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
              player_id as "playerId", created_at as "createdAt", updated_at as "updatedAt"
       FROM players
       WHERE team_key = $1
       ORDER BY first_name ASC`,
      [teamKey],
    )
    return result.rows
  }

  async findStats(playerId) {
    const result = await dbQuery(
      `SELECT id, player_id as "playerId", tournament_id as "tournamentId", runs, wickets, catches,
              stumpings, total_points as "totalPoints", created_at as "createdAt", updated_at as "updatedAt"
       FROM player_stats
       WHERE player_id = $1`,
      [playerId],
    )
    return result.rows
  }

  async create(data) {
    const { firstName, lastName, role, teamKey, playerId } = data
    const result = await dbQuery(
      `INSERT INTO players (first_name, last_name, role, team_key, player_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       RETURNING id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
                 player_id as "playerId", created_at as "createdAt", updated_at as "updatedAt"`,
      [firstName, lastName, role, teamKey, playerId],
    )
    return result.rows[0]
  }

  async bulkCreate(players) {
    const values = []
    let paramIndex = 1
    const placeholders = players
      .map((p) => {
        values.push(p.firstName, p.lastName, p.role, p.teamKey, p.playerId)
        const p1 = paramIndex,
          p2 = paramIndex + 1,
          p3 = paramIndex + 2,
          p4 = paramIndex + 3,
          p5 = paramIndex + 4
        paramIndex += 5
        return `($${p1}, $${p2}, $${p3}, $${p4}, $${p5}, now(), now())`
      })
      .join(', ')

    const result = await dbQuery(
      `INSERT INTO players (first_name, last_name, role, team_key, player_id, created_at, updated_at)
       VALUES ${placeholders}
       RETURNING id, first_name as "firstName", last_name as "lastName", role, team_key as "teamKey",
                 player_id as "playerId", created_at as "createdAt", updated_at as "updatedAt"`,
      values,
    )
    return result.rows
  }

  async delete(id) {
    const result = await dbQuery(
      `DELETE FROM players WHERE id = $1
       RETURNING id`,
      [id],
    )
    return result.rows.length > 0
  }
}

export default new PlayerRepository()
