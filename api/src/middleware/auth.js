import jwt from 'jsonwebtoken'

const buildAuth = ({ getUserById, jwtSecret }) => {
  const authenticate = (req, res, next) => {
    const auth = req.header('authorization') || ''
    const [scheme, token] = auth.split(' ')
    if (scheme != 'Bearer' || !token) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    try {
      const payload = jwt.verify(token, jwtSecret)
      const user = getUserById(payload.sub)
      if (!user) {
        return res.status(401).json({ message: 'Unauthorized' })
      }
      req.currentUser = user
      return next()
    } catch {
      return res.status(401).json({ message: 'Unauthorized' })
    }
  }

  const requireRole = (roles) => (req, res, next) => {
    authenticate(req, res, () => {
      if (!roles.includes(req.currentUser.role)) {
        return res.status(403).json({ message: 'Forbidden' })
      }
      return next()
    })
  }

  return { authenticate, requireRole }
}

export { buildAuth }
