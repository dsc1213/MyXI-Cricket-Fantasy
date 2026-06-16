import { dbQuery } from '../db.js'

const mapMatchRow = (row) => ({
  ...row,
  teamEditLockOverride: row.teamEditLockOverride || null,
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
  m.team_edit_lock_override as "teamEditLockOverride",
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
                 team_edit_lock_override as "teamEditLockOverride",
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
                 team_edit_lock_override as "teamEditLockOverride",
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
                 start_time as "startTime", source_key as "sourceKey", status,
                 team_edit_lock_override as "teamEditLockOverride",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [status, id],
    )
    return result.rows[0] ? mapMatchRow(result.rows[0]) : null
  }

  async updateStartTime(id, startTime, status = null) {
    const result = await dbQuery(
      `UPDATE matches
       SET start_time = $1,
           status = COALESCE($3, status),
           updated_at = now()
       WHERE id = $2
       RETURNING id, tournament_id as "tournamentId", name, team_a as "teamA", team_b as "teamB",
                 team_a_key as "teamAKey", team_b_key as "teamBKey",
                 start_time as "startTime", source_key as "sourceKey", status,
                 team_edit_lock_override as "teamEditLockOverride",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [startTime, id, status],
    )
    return result.rows[0] ? mapMatchRow(result.rows[0]) : null
  }

  async updateTeamEditLockOverride(id, override) {
    const normalizedOverride = override || null
    const result = await dbQuery(
      `UPDATE matches
       SET team_edit_lock_override = $1, updated_at = now()
       WHERE id = $2
       RETURNING id, tournament_id as "tournamentId", name, team_a as "teamA", team_b as "teamB",
                 team_a_key as "teamAKey", team_b_key as "teamBKey",
                 start_time as "startTime", source_key as "sourceKey", status,
                 team_edit_lock_override as "teamEditLockOverride",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [normalizedOverride, id],
    )
    return result.rows[0] ? mapMatchRow(result.rows[0]) : null
  }

  async updateProviderMatchId(id, providerMatchId, provider = 'cricbuzz') {
    const normalizedProviderMatchId = (providerMatchId || '').toString().trim() || null
    const result = await dbQuery(
      `WITH updated_match AS (
         SELECT id, tournament_id, name, team_a, team_b, team_a_key, team_b_key,
                start_time, source_key, status, team_edit_lock_override,
                created_at, updated_at
         FROM matches
         WHERE id = $1
       ),
       upsert_sync AS (
         INSERT INTO match_live_syncs (
           match_id, provider, provider_match_id, live_sync_enabled, created_at, updated_at
         )
         SELECT id, $3, $2, true, now(), now()
         FROM updated_match
         ON CONFLICT (match_id) DO UPDATE
         SET provider_match_id = excluded.provider_match_id,
             provider = excluded.provider,
             live_sync_enabled = true,
             updated_at = now()
         RETURNING match_id, provider, provider_match_id, live_sync_enabled,
                   lineup_synced_at, last_score_sync_at, last_provider_status, last_error
       )
       SELECT
         um.id,
         um.tournament_id as "tournamentId",
         um.name,
         um.team_a as "teamA",
         um.team_b as "teamB",
         um.team_a_key as "teamAKey",
         um.team_b_key as "teamBKey",
         um.start_time as "startTime",
         um.source_key as "sourceKey",
         um.status,
         um.team_edit_lock_override as "teamEditLockOverride",
         um.created_at as "createdAt",
         um.updated_at as "updatedAt",
         us.provider as "liveSyncProvider",
         us.provider_match_id as "liveSyncProviderMatchId",
         us.live_sync_enabled as "liveSyncEnabled",
         us.lineup_synced_at as "liveSyncLineupSyncedAt",
         us.last_score_sync_at as "liveSyncLastScoreSyncAt",
         us.last_provider_status as "liveSyncLastProviderStatus",
         us.last_error as "liveSyncLastError"
       FROM updated_match um
       LEFT JOIN upsert_sync us ON us.match_id = um.id`,
      [id, normalizedProviderMatchId, provider || 'cricbuzz'],
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
