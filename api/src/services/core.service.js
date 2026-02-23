import { registerCoreRoutes } from '../routes/coreRoutes.js'

const createCoreService = (dependencies) => {
  const register = (router) => registerCoreRoutes(router, dependencies)
  return { register }
}

export { createCoreService }
