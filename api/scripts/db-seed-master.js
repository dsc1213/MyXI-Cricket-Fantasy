import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import { dbQuery, initDbPool, shouldUsePostgres } from '../src/db.js'

dotenv.config()

const run = async () => {
  if (!shouldUsePostgres()) {
    throw new Error('DB_PROVIDER must be postgres to seed master user')
  }
  const email = (process.env.MASTER_ADMIN_EMAIL || '').toString().trim().toLowerCase()
  const password = (process.env.MASTER_ADMIN_PASSWORD || '').toString()
  const name = (process.env.MASTER_ADMIN_NAME || 'Master Admin').toString().trim()
  const userId = (
    process.env.MASTER_ADMIN_USER_ID ||
    (email ? email.split('@')[0] : 'master')
  )
    .toString()
    .trim()
  const gameName = (process.env.MASTER_ADMIN_GAME_NAME || userId).toString().trim()

  if (!email || !password) {
    throw new Error('MASTER_ADMIN_EMAIL and MASTER_ADMIN_PASSWORD are required')
  }

  initDbPool()
  const passwordHash = bcrypt.hashSync(password, 10)

  const result = await dbQuery(
    `insert into users
      (name, user_id, game_name, email, phone, location, password_hash, status, role)
     values ($1, $2, $3, $4, '', '', $5, 'active', 'master_admin')
     on conflict (email)
     do update set
       name = excluded.name,
       user_id = excluded.user_id,
       game_name = excluded.game_name,
       password_hash = excluded.password_hash,
       status = 'active',
       role = 'master_admin',
       updated_at = now()
     returning id, email, user_id, game_name, role, status`,
    [name, userId, gameName, email, passwordHash],
  )

  const user = result.rows[0]
  console.log(
    `[seed-master] Ready id=${user.id} email=${user.email} userId=${user.user_id} gameName=${user.game_name} role=${user.role} status=${user.status}`,
  )
}

run()
  .catch((error) => {
    console.error(`[seed-master] Failed: ${error?.message || error}`)
    process.exitCode = 1
  })
  .finally(async () => {
    const pool = initDbPool()
    if (pool) await pool.end()
  })
