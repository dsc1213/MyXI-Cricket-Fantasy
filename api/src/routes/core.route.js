import { createCoreController } from '../controllers/core.controller.js'
import { createCoreService } from '../services/core.service.js'

const registerCoreRoute = (router, dependencies) => {
  const coreService = createCoreService(dependencies)
  const coreController = createCoreController({ coreService })
  coreController.register(router)
}

export { registerCoreRoute }
