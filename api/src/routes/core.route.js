import { createCoreController } from '../controllers/core.controller.js'
import { createCoreService } from '../services/core.service.js'

const registerCoreRoute = (router, dependencies) => {
  // Pass all service dependencies to controller
  const coreController = createCoreController(dependencies)
  const coreService = createCoreService(dependencies)
  // Register routes with injected controller
  coreService.register(router, coreController)
}

export { registerCoreRoute }
