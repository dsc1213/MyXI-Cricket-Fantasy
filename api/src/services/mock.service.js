import { registerMockProviderRoutes } from './mockRoutes.service.js'

const createMockService = (dependencies) => {
  const register = (router) => registerMockProviderRoutes(router, dependencies)
  return { register }
}

export { createMockService }
