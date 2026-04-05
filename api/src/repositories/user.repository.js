import { dbQuery } from '../db.js'

class UserRepository {
  mapUserRow(row) {
    if (!row) return null
    return {
      ...row,
      passwordHash: row.passwordHash ?? row.password_hash,
      contestManagerContestId:
        row.contestManagerContestId ?? row.contest_manager_contest_id ?? null,
      createdAt: row.createdAt ?? row.created_at,
      updatedAt: row.updatedAt ?? row.updated_at,
      resetToken: row.resetToken ?? row.reset_token ?? null,
      resetTokenExpiresAt:
        row.resetTokenExpiresAt ?? row.reset_token_expires_at ?? null,
      securityAnswer1Hash:
        row.securityAnswer1Hash ?? row.security_answer_1_hash ?? null,
      securityAnswer2Hash:
        row.securityAnswer2Hash ?? row.security_answer_2_hash ?? null,
      securityAnswer3Hash:
        row.securityAnswer3Hash ?? row.security_answer_3_hash ?? null,
    }
  }

  async findAll(filters = {}) {
    let query = `SELECT id, name, user_id as "userId", game_name as "gameName", email, phone, location, role, status, created_at as "createdAt", updated_at as "updatedAt"
                 FROM users WHERE 1=1`
    const values = []
    let paramIndex = 1

    if (filters.search) {
      query += ` AND (lower(name) LIKE $${paramIndex} OR lower(email) LIKE $${paramIndex} OR lower(user_id) LIKE $${paramIndex})`
      values.push(`%${filters.search.toLowerCase()}%`)
      paramIndex++
    }
    if (filters.role) {
      query += ` AND role = $${paramIndex}`
      values.push(filters.role)
      paramIndex++
    }
    if (filters.status) {
      query += ` AND status = $${paramIndex}`
      values.push(filters.status)
      paramIndex++
    }

    query += ` ORDER BY created_at DESC`

    const result = await dbQuery(query, values)
    return result.rows.map((row) => this.mapUserRow(row))
  }

  async findById(id) {
    const result = await dbQuery(
      `SELECT id, name, user_id as "userId", game_name as "gameName", email, phone, location, role, status, created_at as "createdAt", updated_at as "updatedAt"
       FROM users
       WHERE id = $1`,
      [id],
    )
    return this.mapUserRow(result.rows[0])
  }

  async update(id, data) {
    const {
      name,
      userId,
      gameName,
      email,
      phone,
      location,
      role,
      status,
      contestManagerContestId,
    } = data
    const updates = []
    const values = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (userId !== undefined) {
      updates.push(`user_id = $${paramIndex++}`)
      values.push(userId)
    }
    if (gameName !== undefined) {
      updates.push(`game_name = $${paramIndex++}`)
      values.push(gameName)
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`)
      values.push(email)
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`)
      values.push(phone)
    }
    if (location !== undefined) {
      updates.push(`location = $${paramIndex++}`)
      values.push(location)
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`)
      values.push(role)
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(status)
    }
    if (contestManagerContestId !== undefined) {
      updates.push(`contest_manager_contest_id = $${paramIndex++}`)
      values.push(contestManagerContestId)
    }
    if (updates.length === 0) return this.findById(id)

    updates.push(`updated_at = now()`)
    values.push(id)

    const result = await dbQuery(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, user_id as "userId", game_name as "gameName", email, phone, location, role, status, contest_manager_contest_id, created_at as "createdAt", updated_at as "updatedAt"`,
      values,
    )
    return this.mapUserRow(result.rows[0])
  }

  async findByEmail(email) {
    const result = await dbQuery(
      `SELECT id, name, user_id as "userId", game_name as "gameName", email, phone, location, password_hash, role, status,
              contest_manager_contest_id, created_at, reset_token, reset_token_expires_at,
              security_answer_1_hash, security_answer_2_hash, security_answer_3_hash
       FROM users
       WHERE lower(email) = lower($1)`,
      [email],
    )
    return this.mapUserRow(result.rows[0])
  }

  async findByGameName(gameName) {
    const result = await dbQuery(
      `SELECT id, name, user_id as "userId", game_name as "gameName", email, phone, location, password_hash, role, status,
              contest_manager_contest_id, created_at, reset_token, reset_token_expires_at,
              security_answer_1_hash, security_answer_2_hash, security_answer_3_hash
       FROM users
       WHERE lower(game_name) = lower($1)`,
      [gameName],
    )
    return this.mapUserRow(result.rows[0])
  }

  async createUser(userData) {
    const {
      name,
      userId,
      gameName,
      email,
      phone,
      location,
      passwordHash,
      role,
      status,
      contestManagerContestId,
      securityAnswer1Hash,
      securityAnswer2Hash,
      securityAnswer3Hash,
    } = userData
    const result = await dbQuery(
      `INSERT INTO users (name, user_id, game_name, email, phone, location, password_hash, role, status, contest_manager_contest_id, security_answer_1_hash, security_answer_2_hash, security_answer_3_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now())
       RETURNING id, name, user_id as "userId", game_name as "gameName", email, phone, location, password_hash, role, status, contest_manager_contest_id, created_at, updated_at`,
      [
        name,
        userId,
        gameName,
        email,
        phone,
        location,
        passwordHash,
        role,
        status,
        contestManagerContestId,
        securityAnswer1Hash,
        securityAnswer2Hash,
        securityAnswer3Hash,
      ],
    )
    return this.mapUserRow(result.rows[0])
  }

  async updatePassword(id, passwordHash) {
    const result = await dbQuery(
      `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2
       RETURNING id`,
      [passwordHash, id],
    )
    return result.rows.length > 0
  }

  async updateResetToken(id, resetToken, resetTokenExpiresAt) {
    const result = await dbQuery(
      `UPDATE users SET reset_token = $1, reset_token_expires_at = $2, updated_at = now() WHERE id = $3
       RETURNING id`,
      [resetToken, resetTokenExpiresAt, id],
    )
    return result.rows.length > 0
  }

  async findByIdentifier(identifier) {
    const result = await dbQuery(
      `SELECT id, name, user_id as "userId", game_name as "gameName", email, phone, location, password_hash, role, status,
              contest_manager_contest_id, created_at, reset_token, reset_token_expires_at,
              security_answer_1_hash, security_answer_2_hash, security_answer_3_hash
       FROM users
       WHERE lower(email) = lower($1) OR lower(user_id) = lower($1) OR lower(game_name) = lower($1)
       LIMIT 1`,
      [identifier],
    )
    return this.mapUserRow(result.rows[0])
  }

  async delete(id) {
    const result = await dbQuery(
      `DELETE FROM users
       WHERE id = $1
       RETURNING id`,
      [id],
    )
    return result.rows.length > 0
  }
}

export default new UserRepository()
