import { dbQuery } from '../db.js'

class TournamentRepository {
  async findAll() {
    const result = await dbQuery(
      `SELECT id, name, season, status, source_key as "sourceKey", source,
              tournament_type as "tournamentType", country, league, selected_teams as "selectedTeams",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM tournaments
       ORDER BY created_at DESC`,
    )
    return result.rows.map((row) => ({
      ...row,
      selectedTeams:
        typeof row.selectedTeams === 'string' ? JSON.parse(row.selectedTeams) : row.selectedTeams,
    }))
  }

  async findById(id) {
    const result = await dbQuery(
      `SELECT id, name, season, status, source_key as "sourceKey", source,
              tournament_type as "tournamentType", country, league, selected_teams as "selectedTeams",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM tournaments
       WHERE id = $1`,
      [id],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      ...row,
      selectedTeams:
        typeof row.selectedTeams === 'string' ? JSON.parse(row.selectedTeams) : row.selectedTeams,
    }
  }

  async findBySourceKey(sourceKey) {
    const result = await dbQuery(
      `SELECT id, name, season, status, source_key as "sourceKey", source,
              tournament_type as "tournamentType", country, league, selected_teams as "selectedTeams",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM tournaments
       WHERE source_key = $1`,
      [sourceKey],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      ...row,
      selectedTeams:
        typeof row.selectedTeams === 'string' ? JSON.parse(row.selectedTeams) : row.selectedTeams,
    }
  }

  async create(data) {
    const {
      name,
      season,
      status,
      sourceKey,
      source,
      tournamentType,
      country,
      league,
      selectedTeams,
    } = data
    const result = await dbQuery(
      `INSERT INTO tournaments (
         name, season, status, source_key, source, tournament_type, country, league, selected_teams, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now(), now())
       RETURNING id, name, season, status, source_key as "sourceKey", source,
                 tournament_type as "tournamentType", country, league, selected_teams as "selectedTeams",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        name,
        season || 'default',
        status || 'active',
        sourceKey,
        source || 'manual',
        tournamentType || 'international',
        country || '',
        league || '',
        JSON.stringify(selectedTeams || []),
      ],
    )
    const row = result.rows[0]
    return {
      ...row,
      selectedTeams:
        typeof row.selectedTeams === 'string' ? JSON.parse(row.selectedTeams) : row.selectedTeams,
    }
  }

  async update(id, data) {
    const { name, season, status, source, tournamentType, country, league, selectedTeams } = data
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
    if (source !== undefined) {
      updates.push(`source = $${paramIndex++}`)
      values.push(source)
    }
    if (tournamentType !== undefined) {
      updates.push(`tournament_type = $${paramIndex++}`)
      values.push(tournamentType)
    }
    if (country !== undefined) {
      updates.push(`country = $${paramIndex++}`)
      values.push(country)
    }
    if (league !== undefined) {
      updates.push(`league = $${paramIndex++}`)
      values.push(league)
    }
    if (selectedTeams !== undefined) {
      updates.push(`selected_teams = $${paramIndex++}::jsonb`)
      values.push(JSON.stringify(selectedTeams || []))
    }
    if (updates.length === 0) return this.findById(id)

    updates.push(`updated_at = now()`)
    values.push(id)

    const result = await dbQuery(
      `UPDATE tournaments
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, season, status, source_key as "sourceKey", source,
                 tournament_type as "tournamentType", country, league, selected_teams as "selectedTeams",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values,
    )
    const row = result.rows[0]
    return {
      ...row,
      selectedTeams:
        typeof row.selectedTeams === 'string' ? JSON.parse(row.selectedTeams) : row.selectedTeams,
    }
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
