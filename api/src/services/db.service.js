const createDbService = (dependencies) => {
  void dependencies
  const register = (router) => {
    void router
    // DB mode intentionally does not register seed/mock handlers.
    // Provider controller will return DB fallback payloads until
    // concrete DB-backed services are implemented per endpoint.
  }

  return { register }
}

export { createDbService }
