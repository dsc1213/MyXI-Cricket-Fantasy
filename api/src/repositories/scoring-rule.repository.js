import { dbQuery } from '../db.js'

class ScoringRuleRepository {
  async findDefault() {
    const result = await dbQuery(
      `SELECT id, rules, created_at as "createdAt", updated_at as "updatedAt"
       FROM global_scoring_rules
       WHERE id = true`,
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      ...row,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
    }
  }

  async saveDefault(rules) {
    const result = await dbQuery(
      `INSERT INTO global_scoring_rules (id, rules, created_at, updated_at)
       VALUES (true, $1, now(), now())
       ON CONFLICT (id) DO UPDATE
       SET rules = EXCLUDED.rules, updated_at = now()
       RETURNING id, rules, created_at as "createdAt", updated_at as "updatedAt"`,
      [JSON.stringify(rules)],
    )
    const row = result.rows[0]
    return {
      ...row,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
    }
  }

  async findByTournament(tournamentId) {
    const result = await dbQuery(
      `SELECT id, tournament_id as "tournamentId", rules, created_at as "createdAt", updated_at as "updatedAt"
       FROM scoring_rules
       WHERE tournament_id = $1`,
      [tournamentId],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      ...row,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
    }
  }

  async findById(id) {
    const result = await dbQuery(
      `SELECT id, tournament_id as "tournamentId", rules, created_at as "createdAt", updated_at as "updatedAt"
       FROM scoring_rules
       WHERE id = $1`,
      [id],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      ...row,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
    }
  }

  async create(data) {
    const { tournamentId, rules } = data
    const result = await dbQuery(
      `INSERT INTO scoring_rules (tournament_id, rules, created_at, updated_at)
       VALUES ($1, $2, now(), now())
       RETURNING id, tournament_id as "tournamentId", rules, created_at as "createdAt", updated_at as "updatedAt"`,
      [tournamentId, JSON.stringify(rules)],
    )
    const row = result.rows[0]
    return {
      ...row,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
    }
  }

  async update(id, data) {
    const { rules } = data
    const result = await dbQuery(
      `UPDATE scoring_rules
       SET rules = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, tournament_id as "tournamentId", rules, created_at as "createdAt", updated_at as "updatedAt"`,
      [JSON.stringify(rules), id],
    )
    const row = result.rows[0]
    return {
      ...row,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
    }
  }

  async delete(id) {
    const result = await dbQuery(
      `DELETE FROM scoring_rules WHERE id = $1
       RETURNING id`,
      [id],
    )
    return result.rows.length > 0
  }
}

export default new ScoringRuleRepository()
