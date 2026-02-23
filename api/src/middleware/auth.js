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

const buildAuth = ({ getUserById, jwtSecret }) => {
  const authenticate = async (req, res, next) => {
    const auth = req.header('authorization') || ''
    const [scheme, token] = auth.split(' ')
    const cookieToken = parseCookieToken(req.header('cookie') || '')
    const jwtToken = scheme === 'Bearer' && token ? token : cookieToken
    if (!jwtToken) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    try {
      const payload = jwt.verify(jwtToken, jwtSecret)
      const user = await Promise.resolve(getUserById(payload.sub))
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' })
      }
      user.role = normalizeRole(user.role)
      req.currentUser = user
      return next()
    } catch {
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
