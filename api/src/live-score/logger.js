import { randomUUID } from 'crypto'

const createLiveScoreSyncContext = (trigger = 'unknown') => ({
  syncId: `ls_${Date.now()}_${randomUUID().slice(0, 8)}`,
  trigger,
  scraperCalls: [],
  dbWrites: [],
  liveStatus: {
    matchId: {
      status: 'pending',
      message: 'Provider match id not checked yet',
    },
    pxi: {
      status: 'pending',
      message: 'Playing XI not checked yet',
    },
    latestMatchScores: {
      status: 'pending',
      message: 'Latest match scores not checked yet',
    },
  },
})

const safeDetails = (details = {}) =>
  details && typeof details === 'object' && !Array.isArray(details) ? details : {}

const compact = (value) =>
  value == null || value === '' ? '' : String(value).replace(/\s+/g, ' ').trim()

const buildLogLine = (payload) => {
  const details = safeDetails(payload.details)
  const parts = [
    `syncId=${payload.syncId}`,
    `trigger=${payload.trigger}`,
    `step=${payload.step}`,
    `status=${payload.status}`,
    payload.matchLabel ? `match="${payload.matchLabel}"` : '',
    payload.matchId ? `matchId=${payload.matchId}` : '',
    payload.providerMatchId ? `providerMatchId=${payload.providerMatchId}` : '',
    details.route ? `route=${details.route}` : '',
    details.table ? `table=${details.table}` : '',
    details.action ? `action=${details.action}` : '',
    details.rows != null ? `rows=${details.rows}` : '',
    details.fields ? `fields=${compact(details.fields)}` : '',
    payload.message ? `msg="${compact(payload.message)}"` : '',
  ].filter(Boolean)
  return `[live-score-flow] ${parts.join(' ')}`
}

const recordLiveScoreLog = async (context = {}, entry = {}) => {
  if (!context?.syncId || !entry?.step) return null
  const payload = {
    syncId: context.syncId,
    trigger: context.trigger || '',
    level: entry.level || 'info',
    step: entry.step,
    status: entry.status || 'ok',
    tournamentId: entry.tournamentId == null ? null : String(entry.tournamentId),
    matchId: entry.matchId == null ? null : String(entry.matchId),
    matchLabel: entry.matchLabel || '',
    provider: entry.provider || 'cricbuzz',
    providerMatchId:
      entry.providerMatchId == null ? null : String(entry.providerMatchId),
    message: entry.message || '',
    details: safeDetails(entry.details),
  }
  const method = payload.level === 'error' ? 'error' : payload.level === 'warn' ? 'warn' : 'log'
  console[method](buildLogLine(payload))
  return payload
}

const recordLiveScoreDbWrite = async (context = {}, entry = {}) => {
  const dbWrite = {
    table: entry.table || entry.details?.table || '',
    action: entry.action || entry.details?.action || '',
    rows: entry.rows ?? entry.details?.rows ?? 0,
    fields: Array.isArray(entry.fields)
      ? entry.fields
      : (entry.fields || entry.details?.fields || '')
          .toString()
          .split(',')
          .map((field) => field.trim())
          .filter(Boolean),
    matchId: entry.matchId == null ? context.matchId || null : String(entry.matchId),
    tournamentId:
      entry.tournamentId == null ? context.tournamentId || null : String(entry.tournamentId),
    providerMatchId:
      entry.providerMatchId == null
        ? context.providerMatchId || null
        : String(entry.providerMatchId),
    matchLabel: entry.matchLabel || context.matchLabel || '',
    message: entry.message || '',
    details: safeDetails(entry.details),
  }
  if (Array.isArray(context.dbWrites)) {
    context.dbWrites.push(dbWrite)
  }
  return recordLiveScoreLog(context, {
    step: 'db-write',
    status: 'written',
    ...entry,
    details: {
      table: entry.table || entry.details?.table || '',
      action: entry.action || entry.details?.action || '',
      rows: entry.rows ?? entry.details?.rows,
      fields: Array.isArray(entry.fields)
        ? entry.fields.join(',')
        : entry.fields || entry.details?.fields || '',
      ...(entry.details || {}),
    },
  })
}

export { createLiveScoreSyncContext, recordLiveScoreDbWrite, recordLiveScoreLog }
