const providerPathPrefixes = [
  '/page-load-data',
  '/bootstrap',
  '/tournaments',
  '/contests',
  '/matches',
  '/players',
  '/player-stats',
  '/team-pool',
  '/team-selection',
  '/match-options',
  '/scoring-rules/save',
  '/match-scores/process-excel',
  '/match-scores/save',
  '/live-score',
  '/admin',
]

const shouldHandleProviderPath = (path = '') => {
  const normalizedPath = (path || '').toString()
  if (/^\/users\/[^/]+\/picks$/.test(normalizedPath)) return true
  return providerPathPrefixes.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  )
}

export { shouldHandleProviderPath }
