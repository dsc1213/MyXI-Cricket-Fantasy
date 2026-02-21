import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { buildAuth } from './middleware/auth.js'
import {
  seedMasterAdmin,
  seedMockUsers,
  getUserById,
  resetStore,
  syncUserIdentifiers,
} from './store.js'
import { initMockStateStore } from '../mocks/mockStateStore.js'
import { createRouter } from './routes/index.js'

dotenv.config()

const app = express()
const jwtSecret = process.env.JWT_SECRET || 'dev-secret'
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d'
const requestedMockAutoSeedTeams =
  (process.env.MOCK_AUTO_SEED_TEAMS || '').toString().trim().toLowerCase() === 'true'

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)
app.use(express.json())

const mockState = initMockStateStore()
if (!mockState.loadedFromFile) {
  seedMasterAdmin()
  seedMockUsers()
  syncUserIdentifiers()
  if (mockState.enabled) mockState.persist()
} else {
  syncUserIdentifiers()
}
const mockAutoSeedTeams = Boolean(mockState.enabled && requestedMockAutoSeedTeams)
if (!mockState.enabled && requestedMockAutoSeedTeams) {
  console.warn(
    '[config] MOCK_AUTO_SEED_TEAMS is ignored because MOCK_API is disabled.',
  )
}

const { authenticate, requireRole } = buildAuth({ getUserById, jwtSecret })

const routerConfig = {
  authenticate,
  requireRole,
  jwtSecret,
  jwtExpiresIn,
  mockApiEnabled: mockState.enabled,
  mockAutoSeedTeams,
  persistMockState: mockState.persist,
}

app.use(createRouter(routerConfig))
app.use('/api', createRouter(routerConfig))

export { app, resetStore }
