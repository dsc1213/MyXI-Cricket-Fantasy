import { dbQuery } from '../db.js'
import { recordLiveScoreDbWrite } from './logger.js'

const mapRow = (row) =>
  row
    ? {
        matchId: row.matchId,
        provider: row.provider,
        providerMatchId: row.providerMatchId || null,
        liveSyncEnabled: row.liveSyncEnabled !== false,
        lineupSyncedAt: row.lineupSyncedAt || null,
        lastScoreSyncAt: row.lastScoreSyncAt || null,
        lastProviderStatus: row.lastProviderStatus || '',
        lastError: row.lastError || '',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    : null

class MatchLiveSyncRepository {
  async findByMatchId(matchId) {
    const result = await dbQuery(
      `SELECT match_id as "matchId",
              provider,
              provider_match_id as "providerMatchId",
              live_sync_enabled as "liveSyncEnabled",
              lineup_synced_at as "lineupSyncedAt",
              last_score_sync_at as "lastScoreSyncAt",
              last_provider_status as "lastProviderStatus",
              last_error as "lastError",
              created_at as "createdAt",
              updated_at as "updatedAt"
       FROM match_live_syncs
       WHERE match_id = $1`,
      [matchId],
    )
    return mapRow(result.rows[0])
  }

  async upsert(matchId, data = {}, context = {}) {
    const result = await dbQuery(
      `INSERT INTO match_live_syncs (
         match_id, provider, provider_match_id, live_sync_enabled,
         lineup_synced_at, last_score_sync_at, last_provider_status, last_error,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, COALESCE($4, true), $5, $6, $7, $8, now(), now())
       ON CONFLICT (match_id) DO UPDATE
       SET provider = COALESCE(EXCLUDED.provider, match_live_syncs.provider),
           provider_match_id = COALESCE(EXCLUDED.provider_match_id, match_live_syncs.provider_match_id),
           live_sync_enabled = COALESCE($4, match_live_syncs.live_sync_enabled),
           lineup_synced_at = COALESCE(EXCLUDED.lineup_synced_at, match_live_syncs.lineup_synced_at),
           last_score_sync_at = COALESCE(EXCLUDED.last_score_sync_at, match_live_syncs.last_score_sync_at),
           last_provider_status = COALESCE(EXCLUDED.last_provider_status, match_live_syncs.last_provider_status),
           last_error = COALESCE(EXCLUDED.last_error, match_live_syncs.last_error),
           updated_at = now()
       RETURNING match_id as "matchId",
                 provider,
                 provider_match_id as "providerMatchId",
                 live_sync_enabled as "liveSyncEnabled",
                 lineup_synced_at as "lineupSyncedAt",
                 last_score_sync_at as "lastScoreSyncAt",
                 last_provider_status as "lastProviderStatus",
                 last_error as "lastError",
                 created_at as "createdAt",
                 updated_at as "updatedAt"`,
      [
        matchId,
        data.provider || 'cricbuzz',
        data.providerMatchId || null,
        data.liveSyncEnabled,
        data.lineupSyncedAt || null,
        data.lastScoreSyncAt || null,
        data.lastProviderStatus || null,
        data.lastError || null,
      ],
    )
    const row = mapRow(result.rows[0])
    await recordLiveScoreDbWrite(context, {
      table: 'match_live_syncs',
      action: 'upsert',
      rows: 1,
      fields: [
        'provider_match_id',
        'live_sync_enabled',
        'lineup_synced_at',
        'last_score_sync_at',
        'last_provider_status',
        'last_error',
      ],
      matchId,
      tournamentId: context.tournamentId,
      providerMatchId: row?.providerMatchId,
      matchLabel: context.matchLabel,
      message: `DB wrote match_live_syncs: providerMatchId=${row?.providerMatchId || ''}, lineupSyncedAt=${row?.lineupSyncedAt || ''}, lastScoreSyncAt=${row?.lastScoreSyncAt || ''}, status=${row?.lastProviderStatus || ''}, error=${row?.lastError || ''}`,
      details: {
        providerMatchId: row?.providerMatchId || '',
        liveSyncEnabled: row?.liveSyncEnabled,
        lineupSyncedAt: row?.lineupSyncedAt || '',
        lastScoreSyncAt: row?.lastScoreSyncAt || '',
        lastProviderStatus: row?.lastProviderStatus || '',
        lastError: row?.lastError || '',
      },
    })
    return row
  }

  async updateError(matchId, errorMessage, context = {}) {
    const parts = [
      context.step ? `step=${context.step}` : '',
      context.fn ? `fn=${context.fn}` : '',
      context.route ? `route=${context.route}` : '',
      context.providerMatchId ? `providerMatchId=${context.providerMatchId}` : '',
      context.matchLabel ? `match=${context.matchLabel}` : '',
      context.syncId ? `syncId=${context.syncId}` : '',
      `error=${errorMessage || 'unknown error'}`,
    ].filter(Boolean)
    return this.upsert(
      matchId,
      {
        lastError: parts.join(' | ').slice(0, 500),
      },
      {
        ...context,
        trigger: context.trigger || 'unknown',
        matchId,
      },
    )
  }
}

export default new MatchLiveSyncRepository()
