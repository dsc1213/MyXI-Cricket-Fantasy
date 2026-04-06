import { registerCoreRoutes } from '../routes/coreRoutes.js'

const createCoreService = (dependencies) => {
  // Accept injected controller instance
  const register = (router, coreController) =>
    registerCoreRoutes(router, { ...dependencies, coreController })
  return { register }
}

export { createCoreService }
