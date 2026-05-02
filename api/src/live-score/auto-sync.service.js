import { shouldUsePostgres } from '../db.js'
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
let lastOnDemandScraperAt = 0

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

    const minIntervalMs = getOnDemandMinIntervalMs()
    const now = Date.now()
    if (minIntervalMs > 0 && now - lastOnDemandScraperAt < minIntervalMs) {
      summary.scraperSkipped = {
        reason: 'on-demand-throttled',
        minIntervalMs,
        nextAllowedAt: new Date(lastOnDemandScraperAt + minIntervalMs).toISOString(),
      }
      context.liveStatus.matchId = {
        status: 'throttled',
        message: `Live sync throttled until ${summary.scraperSkipped.nextAllowedAt}`,
      }
      context.liveStatus.pxi = {
        status: 'throttled',
        message: 'Playing XI sync skipped because live sync is throttled',
      }
      context.liveStatus.latestMatchScores = {
        status: 'throttled',
        message: 'Score sync skipped because live sync is throttled',
      }
      await recordLiveScoreLog(context, {
        step: 'sync-run',
        status: 'skipped',
        message: 'On-demand scraper sync throttled',
        details: summary.scraperSkipped,
      })
      return summary
    }

    lastOnDemandScraperAt = now
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
