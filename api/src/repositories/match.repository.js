import { dbQuery } from '../db.js'

const mapMatchRow = (row) => ({
  ...row,
  liveSync: {
    enabled: row.liveSyncEnabled !== false,
    provider: row.liveSyncProvider || 'cricbuzz',
    providerMatchId: row.liveSyncProviderMatchId || row.sourceKey || null,
    lineupSyncedAt: row.liveSyncLineupSyncedAt || null,
    lastScoreSyncAt: row.liveSyncLastScoreSyncAt || null,
    lastProviderStatus: row.liveSyncLastProviderStatus || '',
    lastError: row.liveSyncLastError || '',
  },
})

const matchSelect = `
  m.id,
  m.tournament_id as "tournamentId",
  m.name,
  m.team_a as "teamA",
  m.team_b as "teamB",
  m.team_a_key as "teamAKey",
  m.team_b_key as "teamBKey",
  m.start_time as "startTime",
  m.source_key as "sourceKey",
  m.status,
  m.created_at as "createdAt",
  m.updated_at as "updatedAt",
  mls.provider as "liveSyncProvider",
  mls.provider_match_id as "liveSyncProviderMatchId",
  mls.live_sync_enabled as "liveSyncEnabled",
  mls.lineup_synced_at as "liveSyncLineupSyncedAt",
  mls.last_score_sync_at as "liveSyncLastScoreSyncAt",
  mls.last_provider_status as "liveSyncLastProviderStatus",
  mls.last_error as "liveSyncLastError"
`

class MatchRepository {
  async findAll() {
    const result = await dbQuery(
      `SELECT ${matchSelect}
       FROM matches m
       LEFT JOIN match_live_syncs mls ON mls.match_id = m.id
       ORDER BY m.start_time ASC`,
    )
    return result.rows.map(mapMatchRow)
  }

  async findById(id) {
    const result = await dbQuery(
      `SELECT ${matchSelect}
       FROM matches m
       LEFT JOIN match_live_syncs mls ON mls.match_id = m.id
       WHERE m.id = $1`,
      [id],
    )
    return result.rows[0] ? mapMatchRow(result.rows[0]) : null
  }

  async findByTournament(tournamentId) {
    const result = await dbQuery(
      `SELECT ${matchSelect}
       FROM matches m
       LEFT JOIN match_live_syncs mls ON mls.match_id = m.id
       WHERE m.tournament_id = $1
       ORDER BY m.start_time ASC`,
      [tournamentId],
    )
    return result.rows.map(mapMatchRow)
  }

  async create(data) {
    const { tournamentId, name, teamA, teamB, teamAKey, teamBKey, startTime, sourceKey, status } =
      data
    const result = await dbQuery(
      `INSERT INTO matches (tournament_id, name, team_a, team_b, team_a_key, team_b_key, start_time, source_key, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
       RETURNING id, tournament_id as "tournamentId", name, team_a as "teamA", team_b as "teamB",
                 team_a_key as "teamAKey", team_b_key as "teamBKey",
                 start_time as "startTime", source_key as "sourceKey", status,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        tournamentId,
        name,
        teamA,
        teamB,
        teamAKey,
        teamBKey,
        startTime,
        sourceKey || null,
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
          m.sourceKey || null,
          m.status || 'scheduled',
        )
        const p1 = paramIndex,
          p2 = paramIndex + 1,
          p3 = paramIndex + 2,
          p4 = paramIndex + 3,
          p5 = paramIndex + 4,
          p6 = paramIndex + 5,
          p7 = paramIndex + 6,
          p8 = paramIndex + 7,
          p9 = paramIndex + 8
        paramIndex += 9
        return `($${p1}, $${p2}, $${p3}, $${p4}, $${p5}, $${p6}, $${p7}, $${p8}, $${p9}, now(), now())`
      })
      .join(', ')

    const result = await dbQuery(
      `INSERT INTO matches (tournament_id, name, team_a, team_b, team_a_key, team_b_key, start_time, source_key, status, created_at, updated_at)
       VALUES ${placeholders}
       RETURNING id, tournament_id as "tournamentId", name, team_a as "teamA", team_b as "teamB",
                 team_a_key as "teamAKey", team_b_key as "teamBKey",
                 start_time as "startTime", source_key as "sourceKey", status,
                 created_at as "createdAt", updated_at as "updatedAt"`,
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
                 start_time as "startTime", source_key as "sourceKey", status, created_at as "createdAt", updated_at as "updatedAt"`,
      [status, id],
    )
    return result.rows[0] ? mapMatchRow(result.rows[0]) : null
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
