import { updateStoredSession } from './auth.js'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const inFlightGetRequests = new Map()
const cachedGetResponses = new Map()
const apiActivityListeners = new Set()
let pendingApiRequestCount = 0
let pendingRefreshRequest = null
const SESSION_REFRESH_WINDOW_MS = 30 * 1000
const GET_CACHE_TTL_MS = 30 * 1000

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
  clearGetResponseCache()
}

const cloneData = (data) => {
  if (data == null) return data
  return JSON.parse(JSON.stringify(data))
}

const getCachedGetResponse = (key, ttlMs = GET_CACHE_TTL_MS) => {
  const cached = cachedGetResponses.get(key)
  if (!cached) return null
  if (Date.now() - cached.ts > ttlMs) {
    cachedGetResponses.delete(key)
    return null
  }
  return cloneData(cached.data)
}

const setCachedGetResponse = (key, data) => {
  cachedGetResponses.set(key, {
    ts: Date.now(),
    data: cloneData(data),
  })
}

const clearGetResponseCache = () => {
  cachedGetResponses.clear()
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
    } catch {}
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
        throw new Error(message)
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
  const cacheTtlMs =
    typeof options.cacheTtlMs === 'number' && options.cacheTtlMs >= 0
      ? options.cacheTtlMs
      : GET_CACHE_TTL_MS
  const canUseGetCache = method === 'GET' && !normalizedPath.startsWith('/auth/')

  if (canUseGetCache) {
    const cached = getCachedGetResponse(dedupeKey, cacheTtlMs)
    if (cached != null) {
      return cached
    }
  }

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
            if (canUseGetCache) {
              setCachedGetResponse(dedupeKey, data)
            } else if (method !== 'GET') {
              // Any write can change downstream read models. Keep this simple and safe.
              clearGetResponseCache()
            }
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

const login = ({ userId, password }) => {
  // If userId looks like an email, send as email; else as userId
  const isEmail = typeof userId === 'string' && userId.includes('@')
  const payload = isEmail ? { email: userId, password } : { userId, password }
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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

const logout = () =>
  request('/auth/logout', {
    method: 'POST',
  })

const fetchDashboardPageLoadData = async () => {
  try {
    return await request('/page-load-data')
  } catch (error) {
    if ((error?.message || '').includes('404')) {
      return request('/bootstrap')
    }
    throw error
  }
}

const saveScoringRules = ({ rules, actorUserId }) =>
  request('/scoring-rules/save', {
    method: 'POST',
    body: JSON.stringify({ rules, ...(actorUserId ? { actorUserId } : {}) }),
  })

const processExcelMatchScores = ({ fileName }) =>
  request('/match-scores/process-excel', {
    method: 'POST',
    body: JSON.stringify({ fileName }),
  })

const saveMatchScores = ({
  payloadText,
  fileName,
  processedPayload,
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
      source,
      tournamentId,
      contestId,
      matchId,
      userId,
      teamScore,
    }),
  })

const fetchTournaments = () => request('/tournaments')

const fetchContests = ({ game, tournamentId, joined, userId } = {}) => {
  const params = new URLSearchParams()
  if (game) params.set('game', game)
  if (tournamentId) params.set('tournamentId', tournamentId)
  if (typeof joined === 'boolean') params.set('joined', String(joined))
  if (userId) params.set('userId', userId)
  const query = params.toString()
  return request(`/contests${query ? `?${query}` : ''}`)
}

const joinContest = ({ contestId, userId }) =>
  request(`/contests/${contestId}/join`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })

const leaveContest = ({ contestId, userId }) =>
  request(`/contests/${contestId}/leave`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })

const fetchContest = (contestId) => request(`/contests/${contestId}`)

const fetchContestMatches = ({ contestId, status, team, userId } = {}) => {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (team) params.set('team', team)
  if (userId) params.set('userId', userId)
  const query = params.toString()
  return request(`/contests/${contestId}/matches${query ? `?${query}` : ''}`)
}

const fetchContestParticipants = ({ contestId, matchId, userId } = {}) => {
  const params = new URLSearchParams()
  if (matchId) params.set('matchId', matchId)
  if (userId) params.set('userId', userId)
  const query = params.toString()
  return request(`/contests/${contestId}/participants${query ? `?${query}` : ''}`)
}

const fetchContestLeaderboard = async (contestId) => {
  const data = await request(`/contests/${contestId}/leaderboard`)
  if (Array.isArray(data)) {
    return { rows: data }
  }
  if (data && Array.isArray(data.rows)) {
    return data
  }
  return { rows: [] }
}

const fetchContestUserMatchScores = ({ contestId, userId, compareUserId } = {}) => {
  const params = new URLSearchParams()
  if (compareUserId) params.set('compareUserId', compareUserId)
  const query = params.toString()
  return request(
    `/contests/${contestId}/users/${userId}/match-scores${query ? `?${query}` : ''}`,
  )
}

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
  const query = params.toString()
  return request(`/team-pool${query ? `?${query}` : ''}`)
}

const saveTeamSelection = ({
  contestId,
  matchId,
  userId,
  actorUserId,
  playingXi,
  backups,
  captainId,
  viceCaptainId,
}) =>
  request('/team-selection/save', {
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

const fetchUserPicks = ({ userId, tournamentId, contestId, matchId } = {}) => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  if (contestId) params.set('contestId', contestId)
  if (matchId) params.set('matchId', matchId)
  const query = params.toString()
  return request(`/users/${userId}/picks${query ? `?${query}` : ''}`)
}

const fetchPlayers = () => request('/players')
const createAdminPlayer = (payload) =>
  request('/admin/players', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
const importAdminPlayers = (payload) =>
  request('/admin/players', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
const deleteAdminPlayer = ({ id, actorUserId }) =>
  request(`/admin/players/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
const fetchPlayerStats = ({ tournamentId } = {}) => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = params.toString()
  return request(`/player-stats${query ? `?${query}` : ''}`)
}
const fetchMatchOptions = () => request('/match-options')
const fetchPrettyTournaments = () => request('/tournaments/pretty')
const fetchPlayerOverrideContext = ({ contestId, matchId } = {}) => {
  const params = new URLSearchParams()
  if (contestId) params.set('contestId', contestId)
  if (matchId) params.set('matchId', matchId)
  const query = params.toString()
  return request(`/admin/player-overrides/context${query ? `?${query}` : ''}`)
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
  })
const fetchManualScoreContext = ({ tournamentId } = {}) => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = params.toString()
  return request(`/admin/match-score-context${query ? `?${query}` : ''}`)
}
const fetchAdminMatchScores = ({ tournamentId, matchId } = {}) =>
  request(`/admin/match-scores/${tournamentId}/${matchId}`)
const fetchMatchLineups = ({ tournamentId, matchId, contestId } = {}) => {
  const params = new URLSearchParams()
  if (contestId) params.set('contestId', contestId)
  const query = params.toString()
  return request(
    `/admin/match-lineups/${tournamentId}/${matchId}${query ? `?${query}` : ''}`,
  )
}
const upsertMatchLineups = ({
  tournamentId,
  matchId,
  contestId,
  updatedBy,
  source,
  strictSquad,
  lineups,
  meta,
} = {}) =>
  request('/admin/match-lineups/upsert', {
    method: 'POST',
    body: JSON.stringify({
      tournamentId,
      matchId,
      contestId,
      updatedBy,
      source,
      strictSquad,
      lineups,
      meta,
    }),
  })
const upsertManualMatchScores = ({
  tournamentId,
  contestId,
  matchId,
  userId,
  teamScore,
  playerStats,
}) =>
  request('/admin/match-scores/upsert', {
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
const resetManualMatchScores = ({ tournamentId, matchId, userId }) =>
  request('/admin/match-scores/reset', {
    method: 'POST',
    body: JSON.stringify({ tournamentId, matchId, userId }),
  })
const fetchAdminUsers = () => request('/admin/users')
const updateAdminUser = ({ id, payload }) =>
  request(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload || {}),
  })
const deleteAdminUser = ({ id, actorUserId }) =>
  request(`/admin/users/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
const fetchTournamentCatalog = () => request('/admin/tournaments/catalog')
const fetchTournamentMatches = (tournamentId = '') =>
  request(`/tournaments/${encodeURIComponent(tournamentId)}/matches`)
const enableTournaments = (ids = [], actorUserId = '') =>
  request('/admin/tournaments/enable', {
    method: 'POST',
    body: JSON.stringify({ ids, ...(actorUserId ? { actorUserId } : {}) }),
  })
const disableTournaments = (ids = [], actorUserId = '') =>
  request('/admin/tournaments/disable', {
    method: 'POST',
    body: JSON.stringify({ ids, ...(actorUserId ? { actorUserId } : {}) }),
  })
const createAdminTournament = (payload) =>
  request('/admin/tournaments', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
const createAdminAuctionImport = (payload) =>
  request('/admin/auctions/import', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
const deleteAdminTournament = ({ id, actorUserId }) =>
  request(`/admin/tournaments/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
const updateAdminMatchStatus = ({ id, status }) =>
  request(`/admin/matches/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
const replaceAdminMatchBackups = ({ id }) =>
  request(`/admin/matches/${id}/replace-backups`, {
    method: 'POST',
  })
const fetchAdminTeamSquads = (args = '') => {
  const teamCode =
    typeof args === 'string' ? args : (args?.teamCode || '').toString().trim()
  const tournamentId =
    typeof args === 'object' && args ? (args.tournamentId || '').toString().trim() : ''
  const params = new URLSearchParams()
  if (teamCode) params.set('teamCode', teamCode)
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = params.toString()
  return request(`/admin/team-squads${query ? `?${query}` : ''}`)
}
const upsertAdminTeamSquad = (payload) =>
  request('/admin/team-squads', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
const deleteAdminTeamSquad = ({ teamCode, actorUserId, tournamentId }) => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = params.toString()
  return request(`/admin/team-squads/${teamCode}${query ? `?${query}` : ''}`, {
    method: 'DELETE',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
}
const createAdminContest = (payload) =>
  request('/admin/contests', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  })
const startAdminContest = (contestId, actorUserId = '') =>
  request(`/admin/contests/${contestId}/start`, {
    method: 'POST',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
const fetchContestMatchOptions = (tournamentId = '') => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = params.toString()
  return request(`/admin/contest-match-options${query ? `?${query}` : ''}`)
}
const deleteAdminContest = (contestId, actorUserId = '') =>
  request(`/admin/contests/${contestId}`, {
    method: 'DELETE',
    body: JSON.stringify(actorUserId ? { actorUserId } : {}),
  })
const fetchContestCatalog = (tournamentId = '') => {
  const params = new URLSearchParams()
  if (tournamentId) params.set('tournamentId', tournamentId)
  const query = params.toString()
  return request(`/admin/contests/catalog${query ? `?${query}` : ''}`)
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
  login,
  refreshSession,
  logout,
  register,
  fetchAccountStatus,
  forgotPassword,
  resetPassword,
  changePassword,
  fetchDashboardPageLoadData,
  processExcelMatchScores,
  saveScoringRules,
  saveMatchScores,
  fetchTournaments,
  fetchContests,
  joinContest,
  leaveContest,
  fetchContest,
  fetchContestMatches,
  fetchContestParticipants,
  fetchContestLeaderboard,
  fetchContestUserMatchScores,
  fetchTeamPool,
  saveTeamSelection,
  fetchUserPicks,
  fetchPlayers,
  createAdminPlayer,
  importAdminPlayers,
  deleteAdminPlayer,
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
  deleteAdminTournament,
  updateAdminMatchStatus,
  replaceAdminMatchBackups,
  fetchAdminTeamSquads,
  upsertAdminTeamSquad,
  deleteAdminTeamSquad,
  createAdminContest,
  startAdminContest,
  fetchContestMatchOptions,
  deleteAdminContest,
  fetchContestCatalog,
  syncContestSelections,
  prefetchAppData,
  updateUserProfile,
}
