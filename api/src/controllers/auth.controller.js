import jwt from 'jsonwebtoken'
import { mapAuthSessionResponse, mapUserToPublic } from '../helpers/authHelpers.js'

const createAuthController = ({ authService }) => {
  const cookieBaseOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
  const authCookieOptions = {
    ...cookieBaseOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }

  const sendError = (res, error) => {
    const status = error?.statusCode || error?.status || 500
    return res.status(status).json({ message: error?.message || 'Internal server error' })
  }
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
  const resolveRequestUser = (req) => {
    if (req.currentUser) return req.currentUser
    const auth = req.header('authorization') || ''
    const [scheme, token] = auth.split(' ')
    const cookieToken = parseCookieToken(req.header('cookie') || '')
    const jwtToken = scheme === 'Bearer' && token ? token : cookieToken
    if (jwtToken) {
      try {
        const payload = jwt.verify(jwtToken, process.env.JWT_SECRET || 'dev-secret')
        if (payload?.sub != null) {
          return { id: payload.sub, role: payload.role }
        }
      } catch {
        // fall back to explicit actor ids below
      }
    }
    if (req.body?.actorUserId != null) {
      return {
        id: req.body.actorUserId,
        role: req.body?.actorRole,
      }
    }
    return null
  }
  const handle =
    (fn) =>
    async (req, res) => {
      try {
        await fn(req, res)
      } catch (error) {
        return sendError(res, error)
      }
    }

  const health = (req, res) => res.json({ status: 'ok' })

  const register = handle(async (req, res) => {
    const user = await authService.registerUser(req.body || {})
    return res.status(201).json(mapUserToPublic(user))
  })

  const login = handle(async (req, res) => {
    const result = await authService.loginUser(req.body || {})
    res.cookie('myxi_auth', result.token, authCookieOptions)
    return res.json(
      mapAuthSessionResponse({
        user: result.user,
        role: result.role,
        token: result.token,
        tokenExpiresAt: result.tokenExpiresAt,
      }),
    )
  })

  const logout = (req, res) => {
    res.clearCookie('myxi_auth', cookieBaseOptions)
    return res.json({ ok: true })
  }

  const refresh = handle(async (req, res) => {
    const result = await authService.refreshUserSession(req.currentUser)
    res.cookie('myxi_auth', result.token, authCookieOptions)
    return res.json(
      mapAuthSessionResponse({
        user: result.user,
        role: result.role,
        token: result.token,
        tokenExpiresAt: result.tokenExpiresAt,
        ok: true,
      }),
    )
  })

  const forgotPassword = handle(async (req, res) => {
    const result = await authService.forgotPassword(req.body || {})
    return res.json(result)
  })

  const accountStatus = handle(async (req, res) => {
    const result = await authService.getUserStatus(req.body || {})
    return res.json(result)
  })

  const resetPassword = handle(async (req, res) => {
    const result = await authService.resetPassword(req.body || {})
    return res.json(result)
  })

  const changePassword = handle(async (req, res) => {
    const result = await authService.changePassword({
      user: resolveRequestUser(req),
      ...(req.body || {}),
    })
    return res.json(result)
  })

  const approveUser = handle(async (req, res) => {
    const result = await authService.approveUser(req.body || {})
    return res.json(result)
  })

  const updateProfile = handle(async (req, res) => {
    const result = await authService.updateUserProfile({
      targetUserId: req.params?.id,
      actor: resolveRequestUser(req),
      ...(req.body || {}),
    })
    return res.json(mapUserToPublic(result))
  })

  return {
    health,
    register,
    login,
    logout,
    refresh,
    accountStatus,
    forgotPassword,
    resetPassword,
    changePassword,
    approveUser,
    updateProfile,
  }
}

export { createAuthController }
