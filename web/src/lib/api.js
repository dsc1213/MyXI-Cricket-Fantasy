import { updateStoredSession } from './auth.js'
import {
  clearAllAppQueryCache,
  fetchCachedQuery,
  invalidateAppQueryCache,
  primeAppQueryCache,
} from './appQueryCache.js'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const inFlightGetRequests = new Map()
const apiActivityListeners = new Set()
let pendingApiRequestCount = 0
let pendingRefreshRequest = null
const SESSION_REFRESH_WINDOW_MS = 30 * 1000

const emitApiActivity = () => {
  apiActivityListeners.forEach((listener) => {
    listener(pendingApiRequestCount)
  })
}

const onApiRequestStart = () => {
  pendingApiRequestCount += 1
  emitApiActivity()
}

const onApiRequestEnd = () => {
  pendingApiRequestCount = Math.max(0, pendingApiRequestCount - 1)
  emitApiActivity()
}

const subscribeApiActivity = (listener) => {
  if (typeof listener !== 'function') return () => {}
  apiActivityListeners.add(listener)
  listener(pendingApiRequestCount)
  return () => {
    apiActivityListeners.delete(listener)
  }
}

const getStoredSessionExpiry = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('myxi-user')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const expiry = Number(parsed?.tokenExpiresAt || 0)
    return Number.isFinite(expiry) && expiry > 0 ? expiry : null
  } catch {
    return null
  }
}

const updateStoredSessionData = (session = {}) => {
  if (typeof window === 'undefined') return
  updateStoredSession({
    token: session.token,
    tokenExpiresAt: session.tokenExpiresAt,
    name: session.name,
    userId: session.userId,
    gameName: session.gameName,
    email: session.email,
    phone: session.phone,
    location: session.location,
    role: session.role,
    contestManagerContestId: session.contestManagerContestId,
    status: session.status,
  })
}

const clearStoredAuth = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem('myxi-user')
  window.localStorage.removeItem('myxi-token')
  clearAllAppQueryCache()
}

const clearAppDataCache = () => {
  clearAllAppQueryCache()
}

const withSortedParams = (params) => {
  const next = new URLSearchParams()
  Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => next.append(key, value))
  return next.toString()
}

const cachedGet = (key, loader) => fetchCachedQuery({ key, loader })

const primeCachedGet = async (key, loader) => {
  const data = await loader()
  primeAppQueryCache(key, data)
  return data
}

const refreshContestScopedData = async ({ contestId, matchId, userId } = {}) => {
  const tasks = []
  if (contestId) {
    tasks.push(
      primeCachedGet(`contest:${contestId}`, () => request(`/contests/${contestId}`)),
      primeCachedGet(`contestMatches:${contestId}:all`, () =>
        request(`/contests/${contestId}/matches`),
      ),
      primeCachedGet(`contestParticipants:${contestId}:all`, () =>
        request(`/contests/${contestId}/participants`),
      ),
      primeCachedGet(`contestLeaderboard:${contestId}`, async () => {
        const data = await request(`/contests/${contestId}/leaderboard`)
        if (Array.isArray(data)) return { rows: data }
        if (data && Array.isArray(data.rows)) return data
        return { rows: [] }
      }),
    )
    if (matchId) {
      tasks.push(
        primeCachedGet(`contestParticipants:${contestId}:matchId=${matchId}`, () =>
          request(`/contests/${contestId}/participants?matchId=${encodeURIComponent(matchId)}`),
        ),
      )
    }
  }
  if (userId && contestId) {
    tasks.push(
      primeCachedGet(`userPicks:${userId}:contestId=${contestId}&matchId=${matchId || ''}`, () => {
        const params = new URLSearchParams()
        params.set('contestId', contestId)
        if (matchId) params.set('matchId', matchId)
        return request(`/users/${userId}/picks?${withSortedParams(params)}`)
      }),
    )
  }
  await Promise.allSettled(tasks)
}

const refreshMatchAdminData = async ({ tournamentId, matchId, contestId } = {}) => {
  const tasks = []
  if (tournamentId && matchId) {
    tasks.push(
      primeCachedGet(`adminMatchScores:${tournamentId}:${matchId}`, () =>
        request(`/admin/match-scores/${tournamentId}/${matchId}`),
      ),
      primeCachedGet(`matchLineups:${tournamentId}:${matchId}:all`, () =>
        request(`/admin/match-lineups/${tournamentId}/${matchId}`),
      ),
    )
    const params = new URLSearchParams()
    params.set('tournamentId', tournamentId)
    params.set('matchId', matchId)
    if (contestId) params.set('contestId', contestId)
    const query = withSortedParams(params)
    tasks.push(
      primeCachedGet(`teamPool:${query}`, () => request(`/team-pool?${query}`)),
    )
  }
  await Promise.allSettled(tasks)
}

const rawApiRequest = async (path, options = {}) => {
  const normalizedPath = path
  const { skipAuthHeader = false, ...fetchOptions } = options
  const method = (fetchOptions.method || 'GET').toString().toUpperCase()
  const candidates = [`${API_BASE}${normalizedPath}`]
  if (!normalizedPath.startsWith('/api/')) {
    candidates.push(`${API_BASE}/api${normalizedPath}`)
  }
  let lastError = null
  // Get token from localStorage if present
  let token = null
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem('myxi-user')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.token) token = parsed.token
      }
    } catch {
      // Ignore malformed stored session payloads and continue without auth.
    }
  }
  for (const url of candidates) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers || {}),
      }
      // Always send Authorization header if token is present
      if (token && !skipAuthHeader) headers['Authorization'] = `Bearer ${token}`
      const response = await fetch(url, {
        credentials: 'include',
        headers,
        ...fetchOptions,
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 404) {
        if (method !== 'GET') {
          const message = data?.message || 'Request failed: 404'
          throw new Error(message)
        }
        lastError = new Error(`Request failed: 404`)
        continue
      }
      if (!response.ok) {
        const message = data?.message || `Request failed: ${response.status}`
        const requestError = new Error(message)
        requestError.status = response.status
        requestError.data = data
        throw requestError
      }
      return data
    } catch (error) {
      lastError = error
      const text = (error?.message || '').toLowerCase()
      const isNetworkError =
        text.includes('failed to fetch') ||
        text.includes('networkerror') ||
        text.includes('load failed') ||
        text.includes('fetch failed') ||
        text.includes('econnrefused')
      if (!isNetworkError) break
    }
  }
  throw lastError || new Error('Request failed')
}

const ensureFreshSession = async () => {
  const expiry = getStoredSessionExpiry()
  if (!expiry) return
  const msLeft = expiry - Date.now()
  if (msLeft > SESSION_REFRESH_WINDOW_MS) return
  if (pendingRefreshRequest) {
    await pendingRefreshRequest
    return
  }
  pendingRefreshRequest = rawApiRequest('/auth/refresh', {
    method: 'POST',
    skipAuthHeader: true,
  })
    .then((data) => {
      if (data?.token || data?.tokenExpiresAt) updateStoredSessionData(data)
      return data
    })
    .finally(() => {
      pendingRefreshRequest = null
    })
  await pendingRefreshRequest
}

async function request(path, options = {}) {
  const normalizedPath = path
  const method = (options.method || 'GET').toUpperCase()
  const dedupeKey = method === 'GET' ? `${method}:${normalizedPath}` : null

  if (dedupeKey && inFlightGetRequests.has(dedupeKey)) {
    return inFlightGetRequests.get(dedupeKey)
  }

  const runner = async () => {
    onApiRequestStart()
    try {
      if (!normalizedPath.startsWith('/auth/')) {
        await ensureFreshSession()
      }

      let hasRetriedAfterRefresh = false
      try {
        while (true) {
          try {
            const data = await rawApiRequest(normalizedPath, options)
            if (data?.token || data?.tokenExpiresAt) updateStoredSessionData(data)
            return data
          } catch (error) {
            const text = (error?.message || '').toLowerCase()
            const canRetryWithSessionRefresh =
              !normalizedPath.startsWith('/auth/') &&
              !hasRetriedAfterRefresh &&
              text.includes('unauthorized')
            if (!canRetryWithSessionRefresh) throw error
            hasRetriedAfterRefresh = true
            const refreshed = await rawApiRequest('/auth/refresh', {
              method: 'POST',
              skipAuthHeader: true,
            })
            if (refreshed?.token || refreshed?.tokenExpiresAt) {
              updateStoredSessionData(refreshed)
            }
          }
        }
      } catch (error) {
        const text = (error?.message || '').toLowerCase()
        if (
          text.includes('failed to fetch') ||
          text.includes('networkerror') ||
          text.includes('load failed')
        ) {
          const configuredBase = API_BASE || 'current origin'
          throw new Error(
            `API unavailable on ${configuredBase}. Check VITE_API_BASE_URL.`,
          )
        }
        throw error
      }
    } finally {
      onApiRequestEnd()
    }
  }

  if (!dedupeKey) {
    return runner()
  }

  const pending = runner().finally(() => {
    inFlightGetRequests.delete(dedupeKey)
  })
  inFlightGetRequests.set(dedupeKey, pending)
  return pending
}

const login = async ({ userId, password }) => {
  // If userId looks like an email, send as email; else as userId
  const isEmail = typeof userId === 'string' && userId.includes('@')
  const payload = isEmail ? { email: userId, password } : { userId, password }
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  clearAllAppQueryCache()
  return data
}

const register = ({
  name,
  gameName,
  phone,
  location,
  email,
  password,
  securityAnswers,
}) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name,
      gameName,
      phone,
      location,
      email,
      password,
      securityAnswers,
    }),
  })

const forgotPassword = ({ userId }) =>
  request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ userId, email: userId }),
  })

const fetchAccountStatus = ({ userId }) =>
  request('/auth/status', {
    method: 'POST',
    body: JSON.stringify({ userId, email: userId }),
  })

const resetPassword = ({ userId, answers, newPassword }) =>
  request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ userId, email: userId, answers, newPassword }),
  })

const changePassword = ({ actorUserId, actorRole, currentPassword, newPassword }) =>
  request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ actorUserId, actorRole, currentPassword, newPassword }),
  })

const refreshSession = () =>
  request('/auth/refresh', {
    method: 'POST',
    skipAuthHeader: true,
  })

const logout = async () => {
  const data = await request('/auth/logout', {
    method: 'POST',
  })
  clearAllAppQueryCache()
  return data
}

const fetchDashboardPageLoadData = async () => {
  return cachedGet('dashboardPageLoadData', async () => {
    try {
      return await request('/page-load-data')
    } catch (error) {
      if ((error?.message || '').includes('404')) {
        return request('/bootstrap')
      }
      throw error
    }
  })
}

const deleteAuditLogs = async ({ ids, actorUserId }) => {
  const data = await request('/admin/audit-logs', {
    method: 'DELETE',
    body: JSON.stringify({
      ids: Array.isArray(ids) ? ids : [],
      ...(actorUserId ? { actorUserId } : {}),
    }),
  })
  invalidateAppQueryCache('dashboardPageLoadData')
  await Promise.allSettled([
    primeCachedGet('dashboardPageLoadData', () => request('/page-load-data')),
  ])
  return data
}

const saveScoringRules = async ({ rules, actorUserId }) => {
  const data = await request('/scoring-rules/save', {
    method: 'POST',
    body: JSON.stringify({ rules, ...(actorUserId ? { actorUserId } : {}) }),
  })
  invalidateAppQueryCache('dashboardPageLoadData')
  await Promise.allSettled([primeCachedGet('dashboardPageLoadData', () => request('/page-load-data'))])
  return data
}

const processExcelMatchScores = ({ fileName }) =>
  request('/match-scores/process-excel', {
    method: 'POST',
    body: JSON.stringify({ fileName }),
  })

const saveMatchScores = ({
  payloadText,
  fileName,
  processedPayload,
  dryRun,
  source,
  tournamentId,
  contestId,
  matchId,
  userId,
  teamScore,
}) =>
  request('/match-scores/save', {
    method: 'POST',
    body: JSON.stringify({
      payloadText,
      fileName,
      processedPayload,
      dryRun,
      source,
      tournamentId,
      contestId,
      matchId,
      userId,
      teamScore,
    }),
  }).finally(() => {
    invalidateAppQueryCache((key) =>
      key === 'dashboardPageLoadData' ||
      key.startsWith('contestLeaderboard:') ||
      key.startsWith('contestParticipants:') ||
      key.startsWith('contestMatches:') ||
      key.startsWith('contestUserMatchScores:') ||
      key.startsWith('tournamentMatches:') ||
      key.startsWith('contestUserPlayerBreakdown:') ||
      key.startsWith('matchLineups:') ||
      key.startsWith('teamPool:') ||
      key.startsWith('userPicks:'),
    )
  })

const saveMatchScoresAndRefresh = async (payload) => {
  const data = await saveMatchScores(payload)
  if (!payload?.dryRun) {
    await Promise.allSettled([
      refreshMatchAdminData({
        tournamentId: payload?.tournamentId,
        matchId: payload?.matchId,
        contestId: payload?.contestId,
      }),
      refreshContestScopedData({
        contestId: payload?.contestId,
        matchId: payload?.matchId,
        userId: payload?.userId,
      }),
    ])
  }
  return data
}

const fetchTournaments = () => cachedGet('tournaments', () => request('/tournaments'))

const fetchContests = ({ game, tournamentId, joined, userId } = {}) => {
  const params = new URLSearchParams()
  if (game) params.set('game', game)
  if (tournamentId) params.set('tournamentId', tournamentId)
  if (typeof joined === 'boolean') params.set('joined', String(joined))
  if (userId) params.set('userId', userId)
  const query = withSortedParams(params)
  return cachedGet(`contests:${query || 'all'}`, () =>
    request(`/contests${query ? `?${query}` : ''}`),
  )
}

const joinContest = async ({ contestId, userId }) => {
  const data = await request(`/contests/${contestId}/join`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  invalidateAppQueryCache(
    (key) =>
      key.startsWith('contests:') ||
      key.startsWith(`contestParticipants:${contestId}:`) ||
      key === `contest:${contestId}` ||
      key === 'dashboardPageLoadData',
  )
  return data
}

const leaveContest = async ({ contestId, userId }) => {
  const data = await request(`/contests/${contestId}/leave`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
  invalidateAppQueryCache(
    (key) =>
      key.startsWith('contests:') ||
      key.startsWith(`contestParticipants:${contestId}:`) ||
      key === `contest:${contestId}` ||
      key === 'dashboardPageLoadData',
  )
  return data
}

const fetchContest = (contestId) =>
  cachedGet(`contest:${contestId}`, () => request(`/contests/${contestId}`))

const fetchContestMatches = ({ contestId, status, team, userId } = {}) => {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (team) params.set('team', team)
  if (userId) params.set('userId', userId)
  const query = withSortedParams(params)
  return cachedGet(`contestMatches:${contestId}:${query || 'all'}`, () =>
    request(`/contests/${contestId}/matches${query ? `?${query}` : ''}`),
  )
}

const fetchContestParticipants = ({ contestId, matchId, userId } = {}) => {
  const params = new URLSearchParams()
  if (matchId) params.set('matchId', matchId)
  if (userId) params.set('userId', userId)
  const query = withSortedParams(params)
  return cachedGet(`contestParticipants:${contestId}:${query || 'all'}`, () =>
    request(`/contests/${contestId}/participants${query ? `?${query}` : ''}`),
  )
}

const fetchContestLeaderboard = async (contestId) => {
  return cachedGet(`contestLeaderboard:${contestId}`, async () => {
    const data = await request(`/contests/${contestId}/leaderboard`)
    if (Array.isArray(data)) {
      return { rows: data }
    }
    if (data && Array.isArray(data.rows)) {
      return data
    }
    return { rows: [] }
  })
}

const fetchContestUserMatchScores = ({ contestId, userId, compareUserId } = {}) => {
  const params = new URLSearchParams()
  if (compareUserId) params.set('compareUserId', compareUserId)
  const query = withSortedParams(params)
  return cachedGet(
    `contestUserMatchScores:${contestId}:${userId}:${query || 'all'}`,
    () =>
      request(
        `/contests/${contestId}/users/${userId}/match-scores${query ? `?${query}` : ''}`,
      ),
  )
}

const fetchContestUserPlayerBreakdown = ({ contestId, userId } = {}) =>
  cachedGet(`contestUserPlayerBreakdown:${contestId}:${userId}`, () =>
    request(`/contests/${contestId}/users/${userId}/player-breakdown`),
  )

const fetchTeamPool = ({
  contestId,
  tournamentId,
  matchId,
  userId,
  actorUserId,
} = {}) => {
  const params = new URLSearchParams()
  if (contestId) params.set('contestId', contestId)
  if (tournamentId) params.set('tournamentId', tournamentId)
  if (matchId) params.set('matchId', matchId)
  if (userId) params.set('userId', userId)
  if (actorUserId) params.set('actorUserId', actorUserId)
  const query = withSortedParams(params)
  return cachedGet(`teamPool:${query || 'all'}`, () =>
    request(`/team-pool${query ? `?${query}` : ''}`),
  )
}

const saveTeamSelection = async ({
  contestId,
  matchId,
  userId,
  actorUserId,
  playingXi,
  backups,
  captainId,
  viceCaptainId,
}) => {
  const data = await request('/team-selection/save', {
    method: 'POST',
    body: JSON.stringify({
      contestId,
      matchId,
      userId,
      actorUserId,
      playingXi,
      backups,
      captainId,
      viceCaptainId,
    }),
  })
  invalidateAppQueryCache((key) =>
    key.startsWith('teamPool:') ||
    key.startsWith('userPicks:') ||
    key.startsWith(`contestParticipants:${contestId}:`) ||
      key === `contest:${contestId}`,
  )
  await Promise.allSettled([
    refreshContestScopedData({ contestId, matchId, userId }),
    primeCachedGet(
      `teamPool:contestId=${contestId}&matchId=${matchId}&userId=${userId}`,
      () =>
        request(
          `/team-pool?contestId=${encodeURIComponent(contestId)}&matchId=${encodeURIComponent(matchId)}&userId=${encodeURIComponent(userId)}`,
        ),
    ),
  ])
  return data
}

const fetchUserPicks = ({ userId, tournamentId, contestId, matchId } = {}) => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  if (contestId) params.set('contestId', contestId)
  if (matchId) params.set('matchId', matchId)
  const query = withSortedParams(params)
  return cachedGet(`userPicks:${userId}:${query || 'all'}`, () =>
    request(`/users/${userId}/picks${query ? `?${query}` : ''}`),
  )
}

const fetchPlayers = () => cachedGet('players', () => request('/players'))
const createAdminPlayer = (payload) =>
  request('/admin/players', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }).finally(() => {
    invalidateAppQueryCache((key) => key === 'players' || key.startsWith('playerStats:'))
  })
const updateAdminPlayer = ({ id, ...payload }) =>
  request(`/admin/players/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload || {}),
  }).finally(() => {
    invalidateAppQueryCache((key) => key === 'players' || key.startsWith('playerStats:'))
  })
const importAdminPlayers = (payload) =>
  request('/admin/players', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }).finally(() => {
    invalidateAppQueryCache((key) => key === 'players' || key.startsWith('playerStats:'))
  })
const deleteAdminPlayer = ({ id, actorUserId }) =>
  request(`/admin/players/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  }).finally(() => {
    invalidateAppQueryCache((key) => key === 'players' || key.startsWith('playerStats:'))
  })
const deleteAdminPlayersBulk = ({ ids, actorUserId }) =>
  request('/admin/players/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids: Array.isArray(ids) ? ids : [], actorUserId }),
  }).finally(() => {
    invalidateAppQueryCache((key) => key === 'players' || key.startsWith('playerStats:'))
  })
const fetchPlayerStats = ({ tournamentId } = {}) => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = withSortedParams(params)
  return cachedGet(`playerStats:${query || 'all'}`, () =>
    request(`/player-stats${query ? `?${query}` : ''}`),
  )
}
const fetchMatchOptions = () => cachedGet('matchOptions', () => request('/match-options'))
const fetchPrettyTournaments = () =>
  cachedGet('prettyTournaments', () => request('/tournaments/pretty'))
const fetchPlayerOverrideContext = ({ contestId, matchId } = {}) => {
  const params = new URLSearchParams()
  if (contestId) params.set('contestId', contestId)
  if (matchId) params.set('matchId', matchId)
  const query = withSortedParams(params)
  return cachedGet(`playerOverrideContext:${query || 'all'}`, () =>
    request(`/admin/player-overrides/context${query ? `?${query}` : ''}`),
  )
}
const savePlayerOverride = ({
  userId,
  outPlayer,
  inPlayer,
  contestId,
  matchId,
  actorUserId,
}) =>
  request('/admin/player-overrides/save', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      outPlayer,
      inPlayer,
      contestId,
      matchId,
      actorUserId,
    }),
  }).finally(() => {
    invalidateAppQueryCache((key) =>
      key.startsWith('playerOverrideContext:') || key.startsWith('teamPool:'),
    )
  })
const fetchManualScoreContext = ({ tournamentId } = {}) => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = withSortedParams(params)
  return cachedGet(`manualScoreContext:${query || 'all'}`, () =>
    request(`/admin/match-score-context${query ? `?${query}` : ''}`),
  )
}
const fetchAdminMatchScores = ({ tournamentId, matchId } = {}) =>
  cachedGet(`adminMatchScores:${tournamentId}:${matchId}`, () =>
    request(`/admin/match-scores/${tournamentId}/${matchId}`),
  )
const fetchMatchLineups = ({ tournamentId, matchId, contestId } = {}) => {
  const params = new URLSearchParams()
  if (contestId) params.set('contestId', contestId)
  const query = withSortedParams(params)
  return cachedGet(`matchLineups:${tournamentId}:${matchId}:${query || 'all'}`, () =>
    request(`/admin/match-lineups/${tournamentId}/${matchId}${query ? `?${query}` : ''}`),
  )
}
const upsertMatchLineups = async ({
  tournamentId,
  matchId,
  contestId,
  updatedBy,
  source,
  dryRun,
  strictSquad,
  lineups,
  meta,
} = {}) => {
  const data = await request('/admin/match-lineups/upsert', {
    method: 'POST',
    body: JSON.stringify({
      tournamentId,
      matchId,
      contestId,
      updatedBy,
      source,
      dryRun,
      strictSquad,
      lineups,
      meta,
    }),
  })
  if (!dryRun) {
    invalidateAppQueryCache((key) =>
      key === 'dashboardPageLoadData' ||
      key.startsWith(`matchLineups:${tournamentId}:${matchId}:`) ||
      key.startsWith('teamPool:') ||
      key.startsWith('contestParticipants:') ||
        key.startsWith('userPicks:'),
    )
    await Promise.allSettled([
      primeCachedGet('dashboardPageLoadData', () => request('/page-load-data')),
      refreshMatchAdminData({ tournamentId, matchId, contestId }),
      refreshContestScopedData({
        contestId,
        matchId,
        userId: updatedBy,
      }),
    ])
  }
  return data
}
const upsertManualMatchScores = async ({
  tournamentId,
  contestId,
  matchId,
  userId,
  teamScore,
  playerStats,
}) => {
  const data = await request('/admin/match-scores/upsert', {
    method: 'POST',
    body: JSON.stringify({
      tournamentId,
      contestId,
      matchId,
      userId,
      teamScore,
      playerStats,
    }),
  })
  invalidateAppQueryCache((key) =>
    key === `adminMatchScores:${tournamentId}:${matchId}` ||
    key.startsWith('dashboardPageLoadData') ||
    key.startsWith('contestLeaderboard:') ||
    key.startsWith('contestUserMatchScores:') ||
    key.startsWith('tournamentMatches:') ||
    key.startsWith('contestUserPlayerBreakdown:') ||
    key.startsWith('userPicks:'),
  )
  await Promise.allSettled([
    refreshMatchAdminData({ tournamentId, matchId, contestId }),
    refreshContestScopedData({ contestId, matchId, userId }),
  ])
  return data
}
const resetManualMatchScores = async ({ tournamentId, matchId, userId }) => {
  const data = await request('/admin/match-scores/reset', {
    method: 'POST',
    body: JSON.stringify({ tournamentId, matchId, userId }),
  })
  invalidateAppQueryCache((key) =>
    key === `adminMatchScores:${tournamentId}:${matchId}` ||
    key.startsWith('contestLeaderboard:') ||
    key.startsWith('contestUserMatchScores:') ||
    key.startsWith('tournamentMatches:') ||
    key.startsWith('contestUserPlayerBreakdown:') ||
    key.startsWith('userPicks:'),
  )
  await Promise.allSettled([
    refreshMatchAdminData({ tournamentId, matchId }),
    refreshContestScopedData({ contestId: '', matchId, userId }),
  ])
  return data
}
const fetchAdminUsers = () => cachedGet('adminUsers', () => request('/admin/users'))
const updateAdminUser = async ({ id, payload }) => {
  const data = await request(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload || {}),
  })
  invalidateAppQueryCache('adminUsers')
  return data
}
const deleteAdminUser = async ({ id, actorUserId }) => {
  const data = await request(`/admin/users/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
  invalidateAppQueryCache('adminUsers')
  return data
}
const fetchTournamentCatalog = () =>
  cachedGet('tournamentCatalog', () => request('/admin/tournaments/catalog'))
const fetchTournamentMatches = (tournamentId = '') =>
  cachedGet(`tournamentMatches:${tournamentId}`, () =>
    request(`/tournaments/${encodeURIComponent(tournamentId)}/matches`),
  )
const enableTournaments = async (ids = [], actorUserId = '') => {
  const data = await request('/admin/tournaments/enable', {
    method: 'POST',
    body: JSON.stringify({ ids, ...(actorUserId ? { actorUserId } : {}) }),
  })
  invalidateAppQueryCache((key) =>
    key === 'tournaments' || key === 'prettyTournaments' || key === 'tournamentCatalog',
  )
  return data
}
const disableTournaments = async (ids = [], actorUserId = '') => {
  const data = await request('/admin/tournaments/disable', {
    method: 'POST',
    body: JSON.stringify({ ids, ...(actorUserId ? { actorUserId } : {}) }),
  })
  invalidateAppQueryCache((key) =>
    key === 'tournaments' || key === 'prettyTournaments' || key === 'tournamentCatalog',
  )
  return data
}
const createAdminTournament = async (payload) => {
  const data = await request('/admin/tournaments', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
  invalidateAppQueryCache((key) =>
    key === 'tournaments' || key === 'prettyTournaments' || key === 'tournamentCatalog',
  )
  return data
}
const createAdminAuctionImport = (payload) =>
  request('/admin/auctions/import', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
const fetchTournamentRemovalPreview = (tournamentId) =>
  request(`/admin/tournaments/${tournamentId}/removal-preview`)

const removeAdminTournament = async ({ id, actorUserId }) => {
  const data = await request(`/admin/tournaments/${id}/remove`, {
    method: 'POST',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
  invalidateAppQueryCache((key) =>
    key === 'tournaments' ||
    key === 'prettyTournaments' ||
    key === 'tournamentCatalog' ||
    key === 'dashboardPageLoadData',
  )
  await Promise.allSettled([primeCachedGet('dashboardPageLoadData', () => request('/page-load-data'))])
  return data
}
const fetchPendingTournamentRemovals = () =>
  request('/admin/pending-removals/tournaments')

const confirmPendingTournamentRemoval = async (tournamentId, actorUserId = '') => {
  const data = await request(`/admin/pending-removals/tournaments/${tournamentId}/confirm`, {
    method: 'POST',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
  invalidateAppQueryCache((key) =>
    key === 'tournaments' ||
    key === 'prettyTournaments' ||
    key === 'tournamentCatalog' ||
    key.startsWith('dashboardPageLoadData:'),
  )
  return data
}

const rejectPendingTournamentRemoval = async (tournamentId, actorUserId = '') => {
  const data = await request(`/admin/pending-removals/tournaments/${tournamentId}/reject`, {
    method: 'POST',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
  invalidateAppQueryCache((key) =>
    key === 'tournaments' ||
    key === 'prettyTournaments' ||
    key === 'tournamentCatalog' ||
    key.startsWith('dashboardPageLoadData:'),
  )
  return data
}
const updateAdminMatchStatus = async ({ id, status }) => {
  const data = await request(`/admin/matches/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
  invalidateAppQueryCache((key) =>
    key.startsWith('tournamentMatches:') || key.startsWith('contestMatches:'),
  )
  return data
}
const replaceAdminMatchBackups = async ({ id }) => {
  const data = await request(`/admin/matches/${id}/replace-backups`, {
    method: 'POST',
  })
  invalidateAppQueryCache(
    (key) =>
      key.startsWith('contestParticipants:') ||
      key.startsWith('contestLeaderboard:') ||
      key.startsWith('contestUserMatchScores:') ||
      key.startsWith('contestUserPlayerBreakdown:') ||
      key.startsWith('userPicks:'),
  )
  await Promise.allSettled([
    primeCachedGet('dashboardPageLoadData', () => request('/page-load-data')),
  ])
  return data
}
const fetchAdminTeamSquads = (args = '') => {
  const teamCode =
    typeof args === 'string' ? args : (args?.teamCode || '').toString().trim()
  const tournamentId =
    typeof args === 'object' && args ? (args.tournamentId || '').toString().trim() : ''
  const params = new URLSearchParams()
  if (teamCode) params.set('teamCode', teamCode)
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = withSortedParams(params)
  return cachedGet(`adminTeamSquads:${query || 'all'}`, () =>
    request(`/admin/team-squads${query ? `?${query}` : ''}`),
  )
}
const upsertAdminTeamSquad = async (payload) => {
  const data = await request('/admin/team-squads', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
  invalidateAppQueryCache('adminTeamSquads')
  return data
}
const deleteAdminTeamSquad = ({ teamCode, actorUserId, tournamentId }) => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = withSortedParams(params)
  return request(`/admin/team-squads/${teamCode}${query ? `?${query}` : ''}`, {
    method: 'DELETE',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  }).finally(() => {
    invalidateAppQueryCache('adminTeamSquads')
  })
}
const createAdminContest = async (payload) => {
  const data = await request('/admin/contests', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
  invalidateAppQueryCache((key) => key.startsWith('contestCatalog:') || key.startsWith('contests:'))
  return data
}
const startAdminContest = async (contestId, actorUserId = '') => {
  const data = await request(`/admin/contests/${contestId}/start`, {
    method: 'POST',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
  invalidateAppQueryCache((key) =>
    key.startsWith('contestCatalog:') ||
    key.startsWith('contests:') ||
    key === `contest:${contestId}`,
  )
  return data
}
const fetchContestMatchOptions = (tournamentId = '') => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = withSortedParams(params)
  return cachedGet(`contestMatchOptions:${query || 'all'}`, () =>
    request(`/admin/contest-match-options${query ? `?${query}` : ''}`),
  )
}
const fetchContestRemovalPreview = (contestId) =>
  request(`/admin/contests/${contestId}/removal-preview`)

const removeAdminContest = async (contestId, actorUserId = '') => {
  const data = await request(`/admin/contests/${contestId}/remove`, {
    method: 'POST',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
  invalidateAppQueryCache((key) =>
    key.startsWith('contestCatalog:') ||
    key.startsWith('contests:') ||
    key === `contest:${contestId}` ||
    key.startsWith('dashboardPageLoadData:'),
  )
  return data
}

const fetchPendingContestRemovals = () =>
  request('/admin/pending-removals/contests')

const confirmPendingContestRemoval = async (contestId, actorUserId = '') => {
  const data = await request(`/admin/pending-removals/contests/${contestId}/confirm`, {
    method: 'POST',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
  invalidateAppQueryCache((key) =>
    key.startsWith('contestCatalog:') ||
    key.startsWith('contests:') ||
    key.startsWith('dashboardPageLoadData:') ||
    key === `contest:${contestId}`,
  )
  return data
}

const rejectPendingContestRemoval = async (contestId, actorUserId = '') => {
  const data = await request(`/admin/pending-removals/contests/${contestId}/reject`, {
    method: 'POST',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
  invalidateAppQueryCache((key) =>
    key.startsWith('contestCatalog:') ||
    key.startsWith('contests:') ||
    key.startsWith('dashboardPageLoadData:') ||
    key === `contest:${contestId}`,
  )
  return data
}
const fetchContestCatalog = (tournamentId = '') => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = withSortedParams(params)
  return cachedGet(`contestCatalog:${query || 'all'}`, () =>
    request(`/admin/contests/catalog${query ? `?${query}` : ''}`),
  )
}
const syncContestSelections = ({ tournamentId, enabledIds }) =>
  request('/admin/contests/sync', {
    method: 'POST',
    body: JSON.stringify({ tournamentId, enabledIds }),
  })

const prefetchAppData = async ({ userId = '', role = '' } = {}) => {
  const tasks = [
    fetchTournaments(),
    fetchPrettyTournaments(),
    fetchContests({ game: 'Fantasy', userId }),
  ]

  if (['admin', 'master_admin'].includes(role)) {
    tasks.push(fetchTournamentCatalog(), fetchAdminUsers())
  }

  if (['contest_manager', 'admin', 'master_admin'].includes(role)) {
    tasks.push(fetchManualScoreContext())
  }

  await Promise.allSettled(tasks)
}

const updateUserProfile = ({ id, payload }) =>
  request(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload || {}),
  })

export {
  subscribeApiActivity,
  clearStoredAuth,
  clearAppDataCache,
  login,
  refreshSession,
  logout,
  register,
  fetchAccountStatus,
  forgotPassword,
  resetPassword,
  changePassword,
  fetchDashboardPageLoadData,
  deleteAuditLogs,
  processExcelMatchScores,
  saveScoringRules,
  saveMatchScoresAndRefresh as saveMatchScores,
  fetchTournaments,
  fetchContests,
  joinContest,
  leaveContest,
  fetchContest,
  fetchContestMatches,
  fetchContestParticipants,
  fetchContestLeaderboard,
  fetchContestUserMatchScores,
  fetchContestUserPlayerBreakdown,
  fetchTeamPool,
  saveTeamSelection,
  fetchUserPicks,
  fetchPlayers,
  createAdminPlayer,
  updateAdminPlayer,
  importAdminPlayers,
  deleteAdminPlayer,
  deleteAdminPlayersBulk,
  fetchPlayerStats,
  fetchMatchOptions,
  fetchPrettyTournaments,
  fetchPlayerOverrideContext,
  savePlayerOverride,
  fetchManualScoreContext,
  fetchAdminMatchScores,
  fetchMatchLineups,
  upsertMatchLineups,
  upsertManualMatchScores,
  resetManualMatchScores,
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  fetchTournamentCatalog,
  fetchTournamentMatches,
  enableTournaments,
  disableTournaments,
  createAdminTournament,
  createAdminAuctionImport,
  fetchTournamentRemovalPreview,
  removeAdminTournament,
  fetchPendingTournamentRemovals,
  confirmPendingTournamentRemoval,
  rejectPendingTournamentRemoval,
  updateAdminMatchStatus,
  replaceAdminMatchBackups,
  fetchAdminTeamSquads,
  upsertAdminTeamSquad,
  deleteAdminTeamSquad,
  createAdminContest,
  startAdminContest,
  fetchContestMatchOptions,
  fetchContestRemovalPreview,
  removeAdminContest,
  fetchPendingContestRemovals,
  confirmPendingContestRemoval,
  rejectPendingContestRemoval,
  fetchContestCatalog,
  syncContestSelections,
  prefetchAppData,
  updateUserProfile,
}
