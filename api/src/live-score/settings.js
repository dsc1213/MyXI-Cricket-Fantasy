const truthyValues = new Set(['1', 'true', 'yes', 'on'])
const AUTO_SYNC_ACTOR_LABEL = 'myxi'

const isAutoUpdateEnabled = () =>
  truthyValues.has(
    (process.env.LIVE_SCORE_AUTO_UPDATE || '').toString().trim().toLowerCase(),
  )

const canCallScraper = () =>
  isAutoUpdateEnabled() && Boolean((process.env.LIVE_SCORE_API_URL || '').toString().trim())

const getOnDemandMinIntervalMs = () => {
  const value = Number(process.env.LIVE_SCORE_ON_DEMAND_MIN_INTERVAL_MS || 300000)
  if (!Number.isFinite(value) || value < 0) return 300000
  return value
}

const getAutoCompleteHours = () => {
  const value = Number(process.env.LIVE_SCORE_AUTO_COMPLETE_AFTER_HOURS || 24)
  if (!Number.isFinite(value) || value <= 0) return 24
  return value
}

const logLiveScore = (action, fields = {}) => {
  console.log(`[live-score] ${action}`, fields)
}

const warnLiveScore = (action, fields = {}) => {
  console.warn(`[live-score] ${action}`, fields)
}

export {
  AUTO_SYNC_ACTOR_LABEL,
  canCallScraper,
  getAutoCompleteHours,
  getOnDemandMinIntervalMs,
  logLiveScore,
  warnLiveScore,
}
