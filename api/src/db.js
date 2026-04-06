import pg from 'pg'

const { Pool } = pg

let pool = null

const getDbProvider = () => (process.env.DB_PROVIDER || '').toString().trim().toLowerCase()
const getDatabaseUrl = () => (process.env.DATABASE_URL || '').toString().trim()
const shouldUsePostgres = () => getDbProvider() === 'postgres'

const getSslConfig = () => {
  // Neon and most managed providers require TLS. Keep this flexible for local DBs.
  if (process.env.DB_SSL_MODE === 'disable') return false
  return { rejectUnauthorized: false }
}

const initDbPool = () => {
  if (!shouldUsePostgres()) return null
  const databaseUrl = getDatabaseUrl()
  if (!databaseUrl) {
    throw new Error('DB_PROVIDER=postgres but DATABASE_URL is missing')
  }
  if (pool) return pool
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: getSslConfig(),
  })
  return pool
}

const checkDbConnection = async () => {
  if (!shouldUsePostgres()) {
    console.log('[db] DB_PROVIDER is not postgres. Skipping DB connectivity check.')
    return { connected: false, skipped: true }
  }

  const activePool = initDbPool()
  const result = await activePool.query('select now() as now')
  const timestamp = result?.rows?.[0]?.now
  console.log(`[db] Connected to Postgres (${timestamp || 'ok'})`)
  return { connected: true, skipped: false, now: timestamp }
}

const dbQuery = async (text, params = []) => {
  const activePool = initDbPool()
  if (!activePool) throw new Error('Postgres pool is not initialized')
  return activePool.query(text, params)
}

export { shouldUsePostgres, initDbPool, checkDbConnection, dbQuery }
