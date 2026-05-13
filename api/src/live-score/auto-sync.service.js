import { shouldUsePostgres } from '../db.js'
import { dbQuery } from '../db.js'
import { runStatusMaintenance } from './status-maintenance.service.js'
import { runScoreSync } from './score-sync.service.js'
import { discoverProviderIdsForStartedMatches } from './lineup-sync.service.js'
import {
  createLiveScoreSyncContext,
  recordLiveScoreLog,
} from './logger.js'
import {
  canCallScraper,
  getOnDemandMinIntervalMs,
} from './settings.js'

let syncRunning = false

const getOnDemandScraperGate = async () => {
  const minIntervalMs = getOnDemandMinIntervalMs()
  if (minIntervalMs <= 0) return { shouldRun: true }
  const result = await dbQuery(
    `WITH started_lineups AS (
       SELECT COUNT(*)::int as count
       FROM matches m
       LEFT JOIN match_live_syncs mls ON mls.match_id = m.id
       WHERE lower(m.status) = ANY($1::text[])
         AND COALESCE(mls.live_sync_enabled, true) = true
         AND mls.lineup_synced_at IS NULL
     ),
     due_scores AS (
       SELECT COUNT(*)::int as count
       FROM matches m
       JOIN match_live_syncs mls ON mls.match_id = m.id
       WHERE lower(m.status) = 'inprogress'
         AND now() >= m.start_time
         AND COALESCE(mls.live_sync_enabled, true) = true
         AND mls.provider_match_id IS NOT NULL
         AND mls.provider_match_id <> ''
         AND mls.lineup_synced_at IS NOT NULL
         AND (
           mls.last_score_sync_at IS NULL
           OR now() >= mls.last_score_sync_at + ($2::int * interval '1 millisecond')
         )
     ),
     throttled_scores AS (
       SELECT MIN(mls.last_score_sync_at + ($2::int * interval '1 millisecond')) as next_allowed_at,
              COUNT(*)::int as count
       FROM matches m
       JOIN match_live_syncs mls ON mls.match_id = m.id
       WHERE lower(m.status) = 'inprogress'
         AND now() >= m.start_time
         AND COALESCE(mls.live_sync_enabled, true) = true
         AND mls.provider_match_id IS NOT NULL
         AND mls.provider_match_id <> ''
         AND mls.lineup_synced_at IS NOT NULL
         AND mls.last_score_sync_at IS NOT NULL
         AND now() < mls.last_score_sync_at + ($2::int * interval '1 millisecond')
     )
     SELECT
       (SELECT count FROM started_lineups) as "lineupCount",
       (SELECT count FROM due_scores) as "dueScoreCount",
       (SELECT count FROM throttled_scores) as "throttledScoreCount",
       (SELECT next_allowed_at FROM throttled_scores) as "nextAllowedAt"`,
    [['started', 'inprogress'], minIntervalMs],
  )
  const row = result.rows?.[0] || {}
  const lineupCount = Number(row.lineupCount || 0)
  const dueScoreCount = Number(row.dueScoreCount || 0)
  const throttledScoreCount = Number(row.throttledScoreCount || 0)
  if (lineupCount > 0 || dueScoreCount > 0) return { shouldRun: true }
  if (throttledScoreCount > 0) {
    return {
      shouldRun: false,
      reason: 'on-demand-throttled',
      minIntervalMs,
      nextAllowedAt: row.nextAllowedAt
        ? new Date(row.nextAllowedAt).toISOString()
        : null,
    }
  }
  return { shouldRun: false, reason: 'not-required', minIntervalMs }
}

const runLiveScoreOnDemandSync = async ({ reason = 'page-load' } = {}) => {
  const context = createLiveScoreSyncContext(reason)
  if (!shouldUsePostgres()) return { skipped: true, reason: 'postgres-required' }
  if (syncRunning) return { skipped: true, reason: 'already-running' }

  syncRunning = true
  const summary = {
    checkedAt: new Date().toISOString(),
    reason,
    statusMaintenance: null,
    discovery: null,
    scoreSync: null,
    scraperSkipped: null,
    syncId: context.syncId,
    scraperCalls: context.scraperCalls,
    dbWrites: context.dbWrites,
    liveStatus: context.liveStatus,
  }

  try {
    await recordLiveScoreLog(context, {
      step: 'sync-run',
      status: 'started',
      message: `On-demand live-score sync started from ${reason}`,
    })
    summary.statusMaintenance = await runStatusMaintenance(context)
    if (!canCallScraper()) {
      summary.scraperSkipped = {
        reason: 'live-tracking-disabled',
        message: 'Live tracking disabled; manual flow continues',
      }
      context.liveStatus.matchId = {
        status: 'disabled',
        message: 'Live tracking disabled; provider match id not checked',
      }
      context.liveStatus.pxi = {
        status: 'disabled',
        message: 'Live tracking disabled; Playing XI not checked',
      }
      context.liveStatus.latestMatchScores = {
        status: 'disabled',
        message: 'Live tracking disabled; latest scores not checked',
      }
      await recordLiveScoreLog(context, {
        step: 'sync-run',
        status: 'skipped',
        message: 'Live tracking disabled; manual flow continues',
        details: summary.scraperSkipped,
      })
      return summary
    }

    const scraperGate = await getOnDemandScraperGate()
    if (!scraperGate.shouldRun) {
      summary.scraperSkipped = scraperGate
      context.liveStatus.matchId = {
        status: scraperGate.reason === 'on-demand-throttled' ? 'throttled' : 'not_required',
        message:
          scraperGate.reason === 'on-demand-throttled'
            ? `Live sync throttled until ${scraperGate.nextAllowedAt || 'next interval'}`
            : 'No match needs provider discovery',
      }
      context.liveStatus.pxi = {
        status: context.liveStatus.matchId.status,
        message:
          scraperGate.reason === 'on-demand-throttled'
            ? 'Playing XI sync skipped because live sync is throttled'
            : 'No match needs Playing XI sync',
      }
      context.liveStatus.latestMatchScores = {
        status: context.liveStatus.matchId.status,
        message:
          scraperGate.reason === 'on-demand-throttled'
            ? 'Score sync skipped because live sync is throttled'
            : 'No match needs score sync',
      }
      await recordLiveScoreLog(context, {
        step: 'sync-run',
        status: 'skipped',
        message:
          scraperGate.reason === 'on-demand-throttled'
            ? 'On-demand live-score sync throttled'
            : 'No live-score scraper work needed',
        details: scraperGate,
      })
      return summary
    }

    summary.discovery = await discoverProviderIdsForStartedMatches(context)
    summary.scoreSync = await runScoreSync(context)
    await recordLiveScoreLog(context, {
      step: 'sync-run',
      status: 'finished',
      message: 'On-demand live-score sync finished',
      details: summary,
    })
    return summary
  } catch (error) {
    await recordLiveScoreLog(context, {
      level: 'error',
      step: 'sync-run',
      status: 'failed',
      message: error?.message || String(error),
      details: {
        fn: 'runLiveScoreOnDemandSync',
        reason,
      },
    })
    throw error
  } finally {
    syncRunning = false
  }
}

export { runLiveScoreOnDemandSync }
