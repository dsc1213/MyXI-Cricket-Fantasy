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

  const existing = await dbQuery(
    `select id
     from users
     where lower(email) = lower($1)
        or role = 'master_admin'
     order by case when lower(email) = lower($1) then 0 else 1 end, id asc
     limit 1`,
    [email],
  )

  const result = existing.rows[0]
    ? await dbQuery(
        `update users
         set name = $1,
             user_id = $2,
             game_name = $3,
             email = $4,
             password_hash = $5,
             status = 'active',
             role = 'master_admin',
             updated_at = now()
         where id = $6
         returning id, email, user_id, game_name, role, status`,
        [name, userId, gameName, email, passwordHash, existing.rows[0].id],
      )
    : await dbQuery(
        `insert into users
          (name, user_id, game_name, email, phone, location, password_hash, status, role)
         values ($1, $2, $3, $4, '', '', $5, 'active', 'master_admin')
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
