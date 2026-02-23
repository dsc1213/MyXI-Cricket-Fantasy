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

  const resetPassword = handle(async (req, res) => {
    const result = await authService.resetPassword(req.body || {})
    return res.json(result)
  })

  const changePassword = handle(async (req, res) => {
    const result = await authService.changePassword({
      user: req.currentUser,
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
      actor: req.currentUser,
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
    forgotPassword,
    resetPassword,
    changePassword,
    approveUser,
    updateProfile,
  }
}

export { createAuthController }
