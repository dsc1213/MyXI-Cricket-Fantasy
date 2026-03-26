import jwt from 'jsonwebtoken'

const parseCookieToken = (cookieHeader = '', key = 'myxi_auth') => {
  const cookie = (cookieHeader || '').toString()
  if (!cookie) return ''
  const parts = cookie.split(';')
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split('=')
    if (rawName !== key) continue
    return decodeURIComponent(rest.join('='))
  }
  return ''
}

const normalizeRole = (role) => {
  if (role === 'master') return 'master_admin'
  if (role === 'player' || role === 'default') return 'user'
  return role
}

const isMockApiEnabled = () =>
  (process.env.MOCK_API || '').toString().trim().toLowerCase() === 'true'

const buildAuth = ({ getUserById, jwtSecret }) => {
  const tryMockActorFallback = async (req) => {
    if (!isMockApiEnabled()) return null
    const rawActorId =
      req.body?.actorUserId ??
      req.body?.userId ??
      req.query?.actorUserId ??
      req.query?.userId ??
      ''
    const raw = rawActorId == null ? '' : rawActorId.toString().trim()
    if (!raw) return null
    const fallbackUser =
      (await Promise.resolve(getUserById(raw))) ||
      (Number.isFinite(Number(raw)) && Number(raw) > 0
        ? await Promise.resolve(getUserById(Number(raw)))
        : null)
    if (!fallbackUser) return null
    fallbackUser.role = normalizeRole(fallbackUser.role)
    return fallbackUser
  }

  const authenticate = async (req, res, next) => {
    const auth = req.header('authorization') || ''
    const [scheme, token] = auth.split(' ')
    const cookieToken = parseCookieToken(req.header('cookie') || '')
    const jwtToken = scheme === 'Bearer' && token ? token : cookieToken
    if (!jwtToken) {
      const fallbackUser = await tryMockActorFallback(req)
      if (fallbackUser) {
        req.currentUser = fallbackUser
        return next()
      }
      return res.status(401).json({ message: 'Unauthorized' })
    }
    try {
      const payload = jwt.verify(jwtToken, jwtSecret)
      const user = await Promise.resolve(getUserById(payload.sub))
      if (!user) {
        const fallbackUser = await tryMockActorFallback(req)
        if (fallbackUser) {
          req.currentUser = fallbackUser
          return next()
        }
        return res.status(401).json({ message: 'Unauthorized' })
      }
      user.role = normalizeRole(user.role)
      req.currentUser = user
      return next()
    } catch {
      const fallbackUser = await tryMockActorFallback(req)
      if (fallbackUser) {
        req.currentUser = fallbackUser
        return next()
      }
      return res.status(401).json({ message: 'Unauthorized' })
    }
  }

  const requireRole = (roles) => (req, res, next) => {
    void authenticate(req, res, () => {
      const currentRole = normalizeRole(req.currentUser.role)
      const normalizedRoles = roles.map(normalizeRole)
      if (!normalizedRoles.includes(currentRole)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
      return next()
    })
  }

  return { authenticate, requireRole }
}

export { buildAuth }
