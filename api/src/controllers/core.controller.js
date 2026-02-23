const createCoreController = ({ coreService }) => {
  const register = (router) => coreService.register(router)
  return { register }
}

export { createCoreController }
