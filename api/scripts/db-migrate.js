import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { initDbPool, shouldUsePostgres } from '../src/db.js'

dotenv.config()
const scriptDir = path.dirname(fileURLToPath(import.meta.url))

const run = async () => {
  if (!shouldUsePostgres()) {
    throw new Error('DB_PROVIDER must be postgres to run migrations')
  }

  const pool = initDbPool()
  await pool.query(`
    create table if not exists schema_migrations (
      id bigserial primary key,
      file_name text not null unique,
      applied_at timestamptz not null default now()
    );
  `)

  const migrationsDir = path.resolve(scriptDir, '../migrations')
  const entries = await fs.readdir(migrationsDir)
  const files = entries.filter((name) => name.endsWith('.sql')).sort()
  const appliedRows = await pool.query('select file_name from schema_migrations')
  const appliedSet = new Set(appliedRows.rows.map((row) => row.file_name))

  for (const fileName of files) {
    if (appliedSet.has(fileName)) continue
    const sql = await fs.readFile(path.join(migrationsDir, fileName), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into schema_migrations(file_name) values ($1)', [fileName])
      await client.query('commit')
      console.log(`[migrate] Applied ${fileName}`)
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }

  console.log('[migrate] Done')
}

run()
  .catch((error) => {
    console.error(`[migrate] Failed: ${error?.message || error}`)
    process.exitCode = 1
  })
  .finally(async () => {
    const pool = initDbPool()
    if (pool) await pool.end()
  })
