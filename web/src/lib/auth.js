const normalizeRole = (role) => {
  if (!role) return 'user'
  if (role === 'master') return 'master_admin'
  if (role === 'player' || role === 'default') return 'user'
  return role
}

const normalizeUser = (user) => {
  if (!user || typeof user !== 'object') return null
  const tokenExpiresAt = Number(user.tokenExpiresAt || 0)
  return {
    ...user,
    role: normalizeRole(user.role),
    token: undefined,
    tokenExpiresAt: Number.isFinite(tokenExpiresAt) && tokenExpiresAt > 0 ? tokenExpiresAt : null,
  }
}

const getStoredUser = () => {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('myxi-user')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const normalized = normalizeUser(parsed)
    if (normalized && normalized.role !== parsed.role) {
      localStorage.setItem('myxi-user', JSON.stringify(normalized))
    }
    return normalized
  } catch {
    return null
  }
}

const setStoredUser = (user) => {
  if (typeof window === 'undefined') return null
  const normalized = normalizeUser(user)
  if (!normalized) {
    localStorage.removeItem('myxi-user')
    return null
  }
  localStorage.setItem('myxi-user', JSON.stringify(normalized))
  return normalized
}

const updateStoredSession = (session = {}) => {
  if (typeof window === 'undefined') return null
  const current = getStoredUser()
  if (!current) return null
  return setStoredUser({
    ...current,
    name: session.name || current.name,
    userId: session.userId || current.userId || current.gameName,
    gameName: session.gameName || current.gameName,
    email: session.email || current.email || '',
    phone: session.phone || current.phone || '',
    location: session.location ?? current.location ?? '',
    role: session.role || current.role,
    contestManagerContestId:
      session.contestManagerContestId !== undefined
        ? session.contestManagerContestId
        : current.contestManagerContestId,
    tokenExpiresAt: session.tokenExpiresAt || current.tokenExpiresAt || null,
    status: session.status || current.status,
  })
}

const clearStoredAuth = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem('myxi-user')
  localStorage.removeItem('myxi-token')
}

export {
  normalizeRole,
  normalizeUser,
  getStoredUser,
  setStoredUser,
  updateStoredSession,
  clearStoredAuth,
}
