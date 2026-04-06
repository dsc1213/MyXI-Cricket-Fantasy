import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { buildAuth } from './middleware/auth.js'
import { checkDbConnection, dbQuery, shouldUsePostgres } from './db.js'
import {
  seedMasterAdmin,
  seedInitialUsers,
  getUserById,
  resetStore as resetStoreTables,
  syncUserIdentifiers,
} from './store.js'
import { initDataState, isAutoSeedTeamsRequested } from './services/stateStore.service.js'
import { createRouter } from './routes/index.js'

dotenv.config()

const runtimeEnv = (process.env.NODE_ENV || 'development').toLowerCase()
let resetMockState = () => {}
let resetMockProviderContexts = () => {}
if (
  (process.env.MOCK_API || '').toString().trim().toLowerCase() === 'true' ||
  runtimeEnv !== 'production'
) {
  try {
    ;({ resetMockState } = await import('../mocks/mockStateStore.js'))
    ;({ resetMockProviderContexts } =
      await import('./services/mockProviderContext.service.js'))
  } catch {}
}

try {
  await checkDbConnection()
} catch (error) {
  const message = error?.message || 'Unknown DB connection error'
  console.error(`[db] Postgres connectivity check failed: ${message}`)
}

const app = express()
const jwtSecret = process.env.JWT_SECRET || 'dev-secret'
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d'
const requestedAutoSeedTeams = isAutoSeedTeamsRequested()

const configuredCorsOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const isLocalOrigin = (origin = '') =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)

const corsOrigin = (() => {
  if (configuredCorsOrigins.length > 0) {
    return (origin, callback) => {
      if (
        !origin ||
        configuredCorsOrigins.includes(origin) ||
        (runtimeEnv !== 'production' && isLocalOrigin(origin))
      ) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'))
    }
  }

  if (runtimeEnv !== 'production') {
    return true
  }

  console.warn(
    '[config] CORS_ORIGIN is not set in production. Cross-origin browser requests are blocked.',
  )
  return false
})()

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
)
app.use(express.json())

const dataState = await initDataState()
console.log(`[config] DATA_PROVIDER=${dataState.enabled ? 'seed' : 'db'}`)
if (runtimeEnv === 'production' && dataState.enabled) {
  console.warn(
    '[config] Production is running with seed/mock data provider enabled. Switch to DB_PROVIDER=postgres for real persistence.',
  )
}
if (runtimeEnv === 'production' && !shouldUsePostgres()) {
  console.warn(
    '[config] Production is running without Postgres. Set DB_PROVIDER=postgres and DATABASE_URL to avoid in-memory runtime.',
  )
}
if (!dataState.loadedFromFile) {
  seedMasterAdmin()
  seedInitialUsers()
  syncUserIdentifiers()
  if (dataState.enabled) dataState.persist()
} else {
  syncUserIdentifiers()
}
const autoSeedTeams = Boolean(dataState.enabled && requestedAutoSeedTeams)
if (!dataState.enabled && requestedAutoSeedTeams) {
  console.warn('[config] AUTO_SEED_TEAMS is ignored because seed provider is disabled.')
}

const resolveUserById = async (id) => {
  if (shouldUsePostgres()) {
    const userId = Number(id)
    if (!Number.isFinite(userId) || userId <= 0) return null
    const result = await dbQuery(
      `select id, name, user_id, game_name, email, phone, location, password_hash, role, status,
              contest_manager_contest_id, created_at, reset_token, reset_token_expires_at
       from users
       where id = $1
       limit 1`,
      [userId],
    )
    const row = result.rows[0]
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      userId: row.user_id,
      gameName: row.game_name,
      email: row.email,
      phone: row.phone || '',
      location: row.location || '',
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      contestManagerContestId: row.contest_manager_contest_id || null,
      createdAt: row.created_at,
      resetToken: row.reset_token || null,
      resetTokenExpiresAt: row.reset_token_expires_at || null,
    }
  }
  return getUserById(id)
}

const { authenticate, requireRole } = buildAuth({
  getUserById: resolveUserById,
  jwtSecret,
})

const routerConfig = {
  authenticate,
  requireRole,
  jwtSecret,
  jwtExpiresIn,
  seedProviderEnabled: dataState.enabled,
  autoSeedTeams,
  persistSeedState: dataState.persist,
}

const resetStore = () => {
  resetMockState()
  resetStoreTables()
  resetMockProviderContexts()
  syncUserIdentifiers()
}

const rootRouter = await createRouter(routerConfig)
const apiRouter = await createRouter(routerConfig)

app.use(rootRouter)
app.use('/api', apiRouter)

app.use((error, req, res, next) => {
  void next
  if (error?.code === '42P01') {
    return res.status(503).json({
      message: 'Database schema is not ready. Run: npm run db:migrate',
      detail: error?.message || 'Undefined table',
    })
  }
  const status = error?.statusCode || error?.status || 500
  if (status >= 500) {
    console.error('[api] Unhandled error', error)
  }
  return res.status(status).json({ message: error?.message || 'Internal server error' })
})

export { app, resetStore }
