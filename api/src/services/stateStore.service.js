import { initMockStateStore } from '../../mocks/mockStateStore.js'

const isAutoSeedTeamsRequested = () =>
  (process.env.MOCK_AUTO_SEED_TEAMS || '').toString().trim().toLowerCase() === 'true'

const initDataState = () => initMockStateStore()

export { isAutoSeedTeamsRequested, initDataState }
