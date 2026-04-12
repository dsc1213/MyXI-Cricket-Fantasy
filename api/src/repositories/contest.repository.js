import { dbQuery } from '../db.js'

class ContestRepository {
  async findAll() {
    const result = await dbQuery(
      `SELECT id, tournament_id as "tournamentId", name, match_ids as "matchIds", prize_structure as "prizeStructure",
              game, mode, source_key as "sourceKey", status, entry_fee as "entryFee",
              max_participants as "maxParticipants", participants_count as "participantsCount",
              start_at as "startAt", started_at as "startedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM contests
       WHERE COALESCE(lower(status), 'open') <> 'pending_removal'
       ORDER BY created_at DESC`,
    )
    return result.rows.map((row) => ({
      ...row,
      matchIds:
        typeof row.matchIds === 'string' ? JSON.parse(row.matchIds) : row.matchIds,
      prizeStructure:
        typeof row.prizeStructure === 'string'
          ? JSON.parse(row.prizeStructure)
          : row.prizeStructure,
    }))
  }

  async findById(id) {
    const result = await dbQuery(
      `SELECT id, tournament_id as "tournamentId", name, match_ids as "matchIds", prize_structure as "prizeStructure",
              game, mode, source_key as "sourceKey", status, entry_fee as "entryFee",
              max_participants as "maxParticipants", participants_count as "participantsCount",
              start_at as "startAt", started_at as "startedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM contests
       WHERE id = $1
         AND COALESCE(lower(status), 'open') <> 'pending_removal'`,
      [id],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      ...row,
      matchIds:
        typeof row.matchIds === 'string' ? JSON.parse(row.matchIds) : row.matchIds,
      prizeStructure:
        typeof row.prizeStructure === 'string'
          ? JSON.parse(row.prizeStructure)
          : row.prizeStructure,
    }
  }

  async findByTournament(tournamentId) {
    const result = await dbQuery(
      `SELECT id, tournament_id as "tournamentId", name, match_ids as "matchIds", prize_structure as "prizeStructure",
              game, mode, source_key as "sourceKey", status, entry_fee as "entryFee",
              max_participants as "maxParticipants", participants_count as "participantsCount",
              start_at as "startAt", started_at as "startedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM contests
       WHERE tournament_id = $1
         AND COALESCE(lower(status), 'open') <> 'pending_removal'
       ORDER BY created_at DESC`,
      [tournamentId],
    )
    return result.rows.map((row) => ({
      ...row,
      matchIds:
        typeof row.matchIds === 'string' ? JSON.parse(row.matchIds) : row.matchIds,
      prizeStructure:
        typeof row.prizeStructure === 'string'
          ? JSON.parse(row.prizeStructure)
          : row.prizeStructure,
    }))
  }

  async create(data) {
    const {
      tournamentId,
      name,
      matchIds,
      prizeStructure,
      game,
      mode,
      sourceKey,
      status,
      entryFee,
      maxParticipants,
      startAt,
      startedAt,
    } = data
    const result = await dbQuery(
      `INSERT INTO contests (
         tournament_id, name, match_ids, prize_structure, game, mode, source_key, status,
         entry_fee, max_participants, participants_count, start_at, started_at, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, now(), now())
       RETURNING id, tournament_id as "tournamentId", name, match_ids as "matchIds", prize_structure as "prizeStructure",
                 game, mode, source_key as "sourceKey", status, entry_fee as "entryFee",
                 max_participants as "maxParticipants", participants_count as "participantsCount",
                 start_at as "startAt", started_at as "startedAt",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        tournamentId,
        name,
        matchIds || [],
        JSON.stringify(prizeStructure || {}),
        game || 'Fantasy',
        mode || 'standard',
        sourceKey || null,
        status || 'active',
        entryFee || 0,
        maxParticipants || 100,
        startAt || null,
        startedAt || null,
      ],
    )
    const row = result.rows[0]
    return {
      ...row,
      matchIds:
        typeof row.matchIds === 'string' ? JSON.parse(row.matchIds) : row.matchIds,
      prizeStructure:
        typeof row.prizeStructure === 'string'
          ? JSON.parse(row.prizeStructure)
          : row.prizeStructure,
    }
  }

  async update(id, data) {
    const { name, matchIds, prizeStructure, game, mode, sourceKey, status, entryFee, maxParticipants, startAt, startedAt } = data
    const updates = []
    const values = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (matchIds !== undefined) {
      updates.push(`match_ids = $${paramIndex++}`)
      values.push(matchIds)
    }
    if (prizeStructure !== undefined) {
      updates.push(`prize_structure = $${paramIndex++}`)
      values.push(JSON.stringify(prizeStructure))
    }
    if (game !== undefined) {
      updates.push(`game = $${paramIndex++}`)
      values.push(game)
    }
    if (mode !== undefined) {
      updates.push(`mode = $${paramIndex++}`)
      values.push(mode)
    }
    if (sourceKey !== undefined) {
      updates.push(`source_key = $${paramIndex++}`)
      values.push(sourceKey)
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(status)
    }
    if (entryFee !== undefined) {
      updates.push(`entry_fee = $${paramIndex++}`)
      values.push(entryFee)
    }
    if (maxParticipants !== undefined) {
      updates.push(`max_participants = $${paramIndex++}`)
      values.push(maxParticipants)
    }
    if (startAt !== undefined) {
      updates.push(`start_at = $${paramIndex++}`)
      values.push(startAt)
    }
    if (startedAt !== undefined) {
      updates.push(`started_at = $${paramIndex++}`)
      values.push(startedAt)
    }
    if (updates.length === 0) return this.findById(id)

    updates.push(`updated_at = now()`)
    values.push(id)

    const result = await dbQuery(
      `UPDATE contests
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, tournament_id as "tournamentId", name, match_ids as "matchIds", prize_structure as "prizeStructure",
                 game, mode, source_key as "sourceKey", status, entry_fee as "entryFee",
                 max_participants as "maxParticipants", participants_count as "participantsCount",
                 start_at as "startAt", started_at as "startedAt",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values,
    )
    const row = result.rows[0]
    return {
      ...row,
      matchIds:
        typeof row.matchIds === 'string' ? JSON.parse(row.matchIds) : row.matchIds,
      prizeStructure:
        typeof row.prizeStructure === 'string'
          ? JSON.parse(row.prizeStructure)
          : row.prizeStructure,
    }
  }

  async delete(id) {
    const result = await dbQuery(
      `DELETE FROM contests WHERE id = $1
       RETURNING id`,
      [id],
    )
    return result.rows.length > 0
  }

  async findByIdIncludingPending(id) {
    const result = await dbQuery(
      `SELECT id, tournament_id as "tournamentId", name, match_ids as "matchIds", prize_structure as "prizeStructure",
              game, mode, source_key as "sourceKey", status, entry_fee as "entryFee",
              max_participants as "maxParticipants", participants_count as "participantsCount",
              start_at as "startAt", started_at as "startedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM contests
       WHERE id = $1`,
      [id],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      ...row,
      matchIds:
        typeof row.matchIds === 'string' ? JSON.parse(row.matchIds) : row.matchIds,
      prizeStructure:
        typeof row.prizeStructure === 'string'
          ? JSON.parse(row.prizeStructure)
          : row.prizeStructure,
    }
  }

  async incrementParticipants(id) {
    await dbQuery(
      `UPDATE contests
       SET participants_count = participants_count + 1, updated_at = now()
       WHERE id = $1`,
      [id],
    )
  }

  async decrementParticipants(id) {
    await dbQuery(
      `UPDATE contests
       SET participants_count = GREATEST(0, participants_count - 1), updated_at = now()
       WHERE id = $1`,
      [id],
    )
  }
}

export default new ContestRepository()
