import { dbQuery } from '../db.js'

class TournamentRepository {
  async findAll() {
    const result = await dbQuery(
      `SELECT id, name, season, status, source_key as "sourceKey", created_at as "createdAt", updated_at as "updatedAt"
       FROM tournaments
       ORDER BY created_at DESC`,
    )
    return result.rows
  }

  async findById(id) {
    const result = await dbQuery(
      `SELECT id, name, season, status, source_key as "sourceKey", created_at as "createdAt", updated_at as "updatedAt"
       FROM tournaments
       WHERE id = $1`,
      [id],
    )
    return result.rows[0]
  }

  async findBySourceKey(sourceKey) {
    const result = await dbQuery(
      `SELECT id, name, season, status, source_key as "sourceKey", created_at as "createdAt", updated_at as "updatedAt"
       FROM tournaments
       WHERE source_key = $1`,
      [sourceKey],
    )
    return result.rows[0]
  }

  async create(data) {
    const { name, season, status, sourceKey } = data
    const result = await dbQuery(
      `INSERT INTO tournaments (name, season, status, source_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, name, season, status, source_key as "sourceKey", created_at as "createdAt", updated_at as "updatedAt"`,
      [name, season || 'default', status || 'active', sourceKey],
    )
    return result.rows[0]
  }

  async update(id, data) {
    const { name, season, status } = data
    const updates = []
    const values = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (season !== undefined) {
      updates.push(`season = $${paramIndex++}`)
      values.push(season)
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(status)
    }
    if (updates.length === 0) return this.findById(id)

    updates.push(`updated_at = now()`)
    values.push(id)

    const result = await dbQuery(
      `UPDATE tournaments
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, season, status, source_key as "sourceKey", created_at as "createdAt", updated_at as "updatedAt"`,
      values,
    )
    return result.rows[0]
  }

  async delete(id) {
    const result = await dbQuery(
      `DELETE FROM tournaments WHERE id = $1
       RETURNING id`,
      [id],
    )
    return result.rows.length > 0
  }
}

export default new TournamentRepository()
