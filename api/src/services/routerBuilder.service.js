import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createProviderController } from '../controllers/provider.controller.js'
import { createDbService } from './db.service.js'
import { createMockService } from './mock.service.js'
import { shouldHandleProviderPath } from './providerPathMatcher.service.js'
import { registerAuthRoutes } from '../routes/auth.route.js'
import { createMockProviderContext } from './mockProviderContext.service.js'

const createRouter = ({
  authenticate,
  requireRole,
  jwtSecret,
  jwtExpiresIn,
  seedProviderEnabled = true,
  autoSeedTeams = false,
  persistSeedState = () => {},
}) => {
  const router = Router()

  router.use((req, res, next) => {
    const originalJson = res.json.bind(res)
    res.json = (payload) => {
      res.set('X-Mock-Data', String(Boolean(seedProviderEnabled)))
      if (
        payload &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        !Object.hasOwn(payload, 'mockData')
      ) {
        return originalJson({ ...payload, mockData: Boolean(seedProviderEnabled) })
      }
      return originalJson(payload)
    }
    return next()
  })

  const mockContext = createMockProviderContext({
    seedProviderEnabled,
    autoSeedTeams,
    persistSeedState,
  })

  registerAuthRoutes(router, {
    users: mockContext.users,
    bcrypt,
    jwt,
    jwtSecret,
    jwtExpiresIn,
    getNextUserId: mockContext.getNextUserId,
    authenticate,
    requireRole,
    persistState: mockContext.persistState,
    appendAuditLog: mockContext.appendAuditLog,
  })

  router.use((req, res, next) => {
    if (req.path.startsWith('/auth/') || req.path.startsWith('/api/auth/')) {
      return next()
    }
    if (seedProviderEnabled && shouldHandleProviderPath(req.path || '')) {
      return next()
    }
    return authenticate(req, res, next)
  })

  const mockProviderRouter = Router()
  const mockService = createMockService(mockContext)
  mockService.register(mockProviderRouter)

  const dbProviderRouter = Router()
  const dbService = createDbService(mockContext)
  dbService.register(dbProviderRouter)

  const providerController = createProviderController({
    mockApiEnabled: seedProviderEnabled,
    shouldHandleProviderPath,
    mockProviderRouter,
    dbProviderRouter,
  })
  router.use(providerController.dispatch)

  return router
}

export { createRouter }
