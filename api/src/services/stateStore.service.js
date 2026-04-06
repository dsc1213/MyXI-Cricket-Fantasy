const isAutoSeedTeamsRequested = () =>
  (process.env.MOCK_AUTO_SEED_TEAMS || '').toString().trim().toLowerCase() === 'true'

const shouldUseSeedProvider = () => {
  const mockApiEnabled =
    (process.env.MOCK_API || '').toString().trim().toLowerCase() === 'true'
  const dbProvider = (process.env.DB_PROVIDER || '').toString().trim().toLowerCase()

  if (mockApiEnabled) return true
  if (dbProvider === 'postgres') return false
  return true
}

const createDisabledState = () => ({
  enabled: false,
  loadedFromFile: false,
  persist: () => {},
})

const initDataState = async () => {
  if (!shouldUseSeedProvider()) return createDisabledState()

  try {
    const { initMockStateStore } = await import('../../mocks/mockStateStore.js')
    return initMockStateStore()
  } catch (error) {
    const message = error?.message || 'Unknown seed store load error'
    console.warn(
      `[config] Seed provider unavailable, falling back to db mode: ${message}`,
    )
    return createDisabledState()
  }
}

export { isAutoSeedTeamsRequested, initDataState }
