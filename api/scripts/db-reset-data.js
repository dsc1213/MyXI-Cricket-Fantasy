import dotenv from 'dotenv'
import { initDbPool, shouldUsePostgres } from '../src/db.js'

dotenv.config()

const RESET_TABLES = [
  'audit_logs',
  'contest_scores',
  'contest_match_players',
  'contest_fixed_rosters',
  'contest_joins',
  'team_selections',
  'player_match_scores',
  'player_stats',
  'match_scores',
  'match_lineups',
  'matches',
  'contests',
  'tournament_players',
  'team_squads',
  'scoring_rules',
  'tournaments',
]

const run = async () => {
  if (!shouldUsePostgres()) {
    throw new Error('DB_PROVIDER must be postgres to reset DB data')
  }

  const pool = initDbPool()
  const existingResult = await pool.query(
    `select tablename
     from pg_tables
     where schemaname = 'public'
       and tablename = any($1::text[])`,
    [RESET_TABLES],
  )
  const existingTables = RESET_TABLES.filter((table) =>
    existingResult.rows.some((row) => row.tablename === table),
  )
  if (!existingTables.length) {
    console.log('[db:reset:data] No matching data tables found, nothing to truncate')
    return
  }

  await pool.query(`truncate table ${existingTables.join(', ')} restart identity cascade;`)
  console.log('[db:reset:data] Truncated app data tables and reset identities')
  console.log('[db:reset:data] Preserved users, players, global_scoring_rules, and schema_migrations')
}

run()
  .catch((error) => {
    console.error(`[db:reset:data] Failed: ${error?.message || error}`)
    process.exitCode = 1
  })
  .finally(async () => {
    const pool = initDbPool()
    if (pool) await pool.end()
  })
