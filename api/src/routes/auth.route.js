import { createAuthController } from '../controllers/auth.controller.js'
import { createAuthService } from '../services/auth.service.js'

const registerAuthRoutes = (
  router,
  {
    users,
    bcrypt,
    jwt,
    jwtSecret,
    jwtExpiresIn,
    getNextUserId,
    authenticate,
    requireRole,
    persistState,
    appendAuditLog,
  },
) => {
  const authService = createAuthService({
    users,
    bcrypt,
    jwt,
    jwtSecret,
    jwtExpiresIn,
    getNextUserId,
    persistState,
    appendAuditLog,
  })
  const authController = createAuthController({ authService })

  router.get('/health', authController.health)
  router.post('/auth/register', authController.register)
  router.post('/auth/login', authController.login)
  router.post('/auth/logout', authController.logout)
  router.post('/auth/refresh', authenticate, authController.refresh)
  router.post('/auth/status', authController.accountStatus)
  router.post('/auth/forgot-password', authController.forgotPassword)
  router.post('/auth/reset-password', authController.resetPassword)
  router.post('/auth/change-password', authenticate, authController.changePassword)
  router.post('/auth/approve-user', requireRole(['master_admin']), authController.approveUser)
  router.patch('/users/:id', authenticate, authController.updateProfile)
}

export { registerAuthRoutes }
