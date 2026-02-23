import { dbQuery, shouldUsePostgres } from '../db.js'
import { mapDbUserToDomain, normalizeRole } from '../helpers/authHelpers.js'

const createHttpError = (statusCode, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const createAuthService = ({
  users,
  bcrypt,
  jwt,
  jwtSecret,
  jwtExpiresIn,
  getNextUserId,
  persistState,
  appendAuditLog,
}) => {
  const isSeedProviderEnabled = () =>
    (process.env.MOCK_API || '').toString().trim().toLowerCase() === 'true'
  const shouldUseDbAuth = () => !isSeedProviderEnabled() && shouldUsePostgres()
  const normalizeIdentity = (value) => (value || '').toString().trim().toLowerCase()
  const hasIdentity = (identitySet, values = []) =>
    values.some((value) => value && identitySet.has(value))
  const inferPrivilegedRole = ({ user, identifier }) => {
    const identityValues = [identifier, user?.userId, user?.gameName, user?.email]
      .map((value) => (value || '').toString().trim().toLowerCase())
      .filter(Boolean)
    const masterAdminEmail = (process.env.MASTER_ADMIN_EMAIL || '')
      .toString()
      .trim()
      .toLowerCase()

    const masterIdentities = new Set(['master', 'master@myxi.local', 'sreecharan', 'sree@myxi.local'])
    const adminIdentities = new Set(['admin', 'admin@myxi.local', 'rahulxi', 'rahul@myxi.local'])
    const contestManagerIdentities = new Set(['contestmgr', 'contestmgr@myxi.local'])

    if (masterAdminEmail && identityValues.includes(masterAdminEmail)) return 'master_admin'
    if (hasIdentity(masterIdentities, identityValues)) return 'master_admin'
    if (hasIdentity(adminIdentities, identityValues)) return 'admin'
    if (hasIdentity(contestManagerIdentities, identityValues)) return 'contest_manager'
    return null
  }
  const buildSessionPayload = (user, role) => ({
    sub: user.id,
    role,
    email: user.email,
    contestManagerContestId: user.contestManagerContestId || null,
  })
  const issueSessionToken = (user, role) => {
    const token = jwt.sign(buildSessionPayload(user, role), jwtSecret, {
      expiresIn: jwtExpiresIn,
    })
    const decoded = jwt.decode(token)
    const tokenExpiresAt = decoded?.exp ? decoded.exp * 1000 : null
    return { token, tokenExpiresAt }
  }
  const findIdentityConflict = async ({ email, gameName, excludeUserId = null }) => {
    if (shouldUseDbAuth()) {
      const normalizedEmail = normalizeIdentity(email)
      const normalizedGameName = normalizeIdentity(gameName)
      const result = await dbQuery(
        `select id, name, user_id, game_name, email, phone, location, password_hash, role, status,
                contest_manager_contest_id, created_at, reset_token, reset_token_expires_at
         from users
         where (($1 <> '' and lower(email) = $1) or ($2 <> '' and lower(game_name) = $2))
           and ($3::bigint is null or id <> $3::bigint)
         limit 1`,
        [normalizedEmail, normalizedGameName, excludeUserId == null ? null : Number(excludeUserId)],
      )
      return mapDbUserToDomain(result.rows[0])
    }
    const normalizedEmail = normalizeIdentity(email)
    const normalizedGameName = normalizeIdentity(gameName)
    return users.find((user) => {
      if (excludeUserId != null && Number(user?.id) === Number(excludeUserId)) return false
      const userEmail = normalizeIdentity(user?.email)
      const userGameName = normalizeIdentity(user?.gameName)
      return (
        (normalizedEmail && userEmail === normalizedEmail) ||
        (normalizedGameName && userGameName === normalizedGameName)
      )
    })
  }
  const findUserByIdentifier = async (identifier = '') => {
    const input = normalizeIdentity(identifier)
    if (!input) return null
    if (shouldUseDbAuth()) {
      const result = await dbQuery(
        `select id, name, user_id, game_name, email, phone, location, password_hash, role, status,
                contest_manager_contest_id, created_at, reset_token, reset_token_expires_at
         from users
         where lower(email) = $1 or lower(user_id) = $1 or lower(game_name) = $1
         limit 1`,
        [input],
      )
      return mapDbUserToDomain(result.rows[0])
    }
    return (
      users.find((item) => {
        return (
          item.email?.toLowerCase() === input ||
          item.userId?.toLowerCase() === input ||
          item.gameName?.toLowerCase() === input
        )
      }) || null
    )
  }
  const findUserById = async (id) => {
    const numericId = Number(id)
    if (!Number.isFinite(numericId) || numericId <= 0) return null
    if (shouldUseDbAuth()) {
      const result = await dbQuery(
        `select id, name, user_id, game_name, email, phone, location, password_hash, role, status,
                contest_manager_contest_id, created_at, reset_token, reset_token_expires_at
         from users
         where id = $1
         limit 1`,
        [numericId],
      )
      return mapDbUserToDomain(result.rows[0])
    }
    return users.find((item) => Number(item?.id) === numericId) || null
  }

  const registerUser = async ({ name, userId, gameName, location, email, phone, password }) => {
    const requestedUserId = (userId || gameName || '').toString().trim()
    if (!name || !requestedUserId || !email || !password) {
      throw createHttpError(400, 'Missing required fields')
    }
    const normalizedEmail = email.toString().trim().toLowerCase()
    const existing = await findIdentityConflict({
      email: normalizedEmail,
      gameName: requestedUserId,
    })
    if (existing) {
      throw createHttpError(409, 'User already exists with same email or user id')
    }

    const passwordHash = bcrypt.hashSync(password, 10)
    if (shouldUseDbAuth()) {
      const inserted = await dbQuery(
        `insert into users
          (name, user_id, game_name, location, email, phone, password_hash, status, role)
         values ($1, $2, $3, $4, $5, $6, $7, 'pending', 'user')
         returning id, name, user_id, game_name, location, email, phone, status`,
        [
          name.toString().trim(),
          requestedUserId,
          requestedUserId,
          (location || '').toString().trim(),
          normalizedEmail,
          (phone || '').toString().trim(),
          passwordHash,
        ],
      )
      return mapDbUserToDomain(inserted.rows[0])
    }

    const user = {
      id: getNextUserId(),
      name: name.toString().trim(),
      userId: requestedUserId,
      gameName: requestedUserId,
      location: (location || '').toString().trim(),
      email: normalizedEmail,
      phone: (phone || '').toString().trim(),
      passwordHash,
      status: 'pending',
      role: 'user',
      createdAt: new Date().toISOString(),
    }
    users.push(user)
    persistState()
    return user
  }

  const loginUser = async ({ email, userId, password }) => {
    const identifier = email || userId
    if (!identifier || !password) throw createHttpError(400, 'Missing required fields')

    const input = normalizeIdentity(identifier)
    const user = await findUserByIdentifier(input)
    if (!user) throw createHttpError(401, 'Invalid credentials')
    if (!user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
      throw createHttpError(401, 'Invalid credentials')
    }

    if (user.status !== 'active') {
      if (user.status === 'pending') {
        throw createHttpError(403, 'User not approved yet. Wait for master admin approval.')
      }
      if (user.status === 'rejected') {
        throw createHttpError(403, 'User registration was rejected.')
      }
      throw createHttpError(403, 'User is not active.')
    }

    let normalizedRole = normalizeRole(user.role)
    const inferredRole = inferPrivilegedRole({ user, identifier: input })
    if (inferredRole && normalizedRole === 'user') {
      normalizedRole = inferredRole
      if (shouldUseDbAuth()) {
        const nextContestScope =
          inferredRole === 'contest_manager' && !user.contestManagerContestId
            ? 'huntercherry'
            : user.contestManagerContestId
        await dbQuery(
          `update users
           set role = $2,
               contest_manager_contest_id = $3
           where id = $1`,
          [user.id, inferredRole, nextContestScope],
        )
        user.role = inferredRole
        user.contestManagerContestId = nextContestScope
      } else {
        user.role = inferredRole
        if (inferredRole === 'contest_manager' && !user.contestManagerContestId) {
          user.contestManagerContestId = 'huntercherry'
        }
        persistState()
      }
    } else if (normalizedRole !== user.role) {
      if (shouldUseDbAuth()) {
        await dbQuery(`update users set role = $2 where id = $1`, [user.id, normalizedRole])
      } else {
        persistState()
      }
      user.role = normalizedRole
    }

    const { token, tokenExpiresAt } = issueSessionToken(user, normalizedRole)
    if (['admin', 'master_admin'].includes(normalizedRole)) {
      appendAuditLog({
        actor: user.name || user.gameName || 'Admin',
        action: 'Admin sign-in',
        target: user.gameName || user.email,
        detail: `Role: ${normalizedRole}`,
        tournamentId: 'global',
        module: 'auth',
      })
    }

    return {
      token,
      tokenExpiresAt,
      user,
      role: normalizedRole,
    }
  }

  const refreshUserSession = async (user) => {
    if (!user || user.status !== 'active') throw createHttpError(401, 'Unauthorized')
    const role = normalizeRole(user.role)
    const { token, tokenExpiresAt } = issueSessionToken(user, role)
    return {
      token,
      tokenExpiresAt,
      user,
      role,
    }
  }

  const forgotPassword = async ({ userId, email }) => {
    const identifier = (email || userId || '').toString().trim().toLowerCase()
    if (!identifier) throw createHttpError(400, 'Missing required fields')
    const user = await findUserByIdentifier(identifier)
    if (!user) {
      return {
        ok: true,
        message: 'If the account exists, a reset token has been generated in mock mode.',
      }
    }

    const token = `rst_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    if (shouldUseDbAuth()) {
      await dbQuery(
        `update users
         set reset_token = $2, reset_token_expires_at = $3
         where id = $1`,
        [user.id, token, expiresAt],
      )
    } else {
      user.resetToken = token
      user.resetTokenExpiresAt = expiresAt
      persistState()
    }
    return {
      ok: true,
      message: 'Reset token generated. Use it to set a new password.',
      resetToken: token,
      expiresAt,
    }
  }

  const resetPassword = async ({ token, newPassword }) => {
    if (!token || !newPassword) throw createHttpError(400, 'Missing required fields')
    if (newPassword.length < 6) throw createHttpError(400, 'Password must be at least 6 characters')

    let user = null
    if (shouldUseDbAuth()) {
      const result = await dbQuery(
        `select id, reset_token_expires_at
         from users
         where reset_token = $1
         limit 1`,
        [token],
      )
      user = result.rows[0] || null
    } else {
      user = users.find((item) => item.resetToken === token) || null
    }
    if (!user) throw createHttpError(400, 'Invalid or expired reset token')

    const expiryTime = new Date(user.resetTokenExpiresAt || user.reset_token_expires_at || '').getTime()
    if (!expiryTime || Number.isNaN(expiryTime) || expiryTime < Date.now()) {
      throw createHttpError(400, 'Invalid or expired reset token')
    }

    if (shouldUseDbAuth()) {
      await dbQuery(
        `update users
         set password_hash = $2, reset_token = null, reset_token_expires_at = null
         where id = $1`,
        [user.id, bcrypt.hashSync(newPassword, 10)],
      )
    } else {
      user.passwordHash = bcrypt.hashSync(newPassword, 10)
      delete user.resetToken
      delete user.resetTokenExpiresAt
      persistState()
    }
    return { ok: true, message: 'Password updated successfully' }
  }

  const changePassword = async ({ user, currentPassword, newPassword }) => {
    if (!currentPassword || !newPassword) throw createHttpError(400, 'Missing required fields')
    if (newPassword.length < 6) throw createHttpError(400, 'Password must be at least 6 characters')
    if (user?.id == null) throw createHttpError(401, 'Unauthorized')
    let targetUser = user
    if (!targetUser?.passwordHash && targetUser?.id != null) {
      targetUser = await findUserById(targetUser.id)
    }
    if (!targetUser?.passwordHash || !bcrypt.compareSync(currentPassword, targetUser.passwordHash)) {
      throw createHttpError(401, 'Current password is incorrect')
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10)
    if (shouldUseDbAuth()) {
      await dbQuery(`update users set password_hash = $2 where id = $1`, [targetUser.id, passwordHash])
    } else {
      targetUser.passwordHash = passwordHash
      persistState()
    }
    return { ok: true, message: 'Password updated successfully' }
  }

  const approveUser = async ({ userId, status }) => {
    if (!userId || !status) throw createHttpError(400, 'Missing required fields')
    if (!['active', 'rejected'].includes(status)) throw createHttpError(400, 'Invalid status')

    let user = null
    if (shouldUseDbAuth()) {
      const result = await dbQuery(`select id, role from users where id = $1 limit 1`, [Number(userId)])
      user = result.rows[0] || null
    } else {
      user = users.find((item) => item.id === Number(userId)) || null
    }
    if (!user) throw createHttpError(404, 'User not found')
    if (user.role === 'master_admin') throw createHttpError(400, 'Cannot modify master admin')

    if (shouldUseDbAuth()) {
      await dbQuery(`update users set status = $2 where id = $1`, [user.id, status])
      return { id: user.id, status }
    }
    user.status = status
    persistState()
    return { id: user.id, status: user.status }
  }

  const updateUserProfile = async ({
    targetUserId,
    actor,
    name,
    gameName,
    email,
    phone,
    location,
  }) => {
    const target = await findUserById(targetUserId)
    if (!target) throw createHttpError(404, 'User not found')
    if (actor?.id == null) throw createHttpError(401, 'Unauthorized')
    const actorRecord = await findUserById(actor.id)
    if (!actorRecord) throw createHttpError(401, 'Unauthorized')
    const actorRole = normalizeRole(actorRecord.role)
    const isSelf = Number(actorRecord.id) === Number(target.id)
    if (!isSelf && !['admin', 'master_admin'].includes(actorRole)) {
      throw createHttpError(403, 'Forbidden')
    }

    const nextName = (name ?? target.name ?? '').toString().trim()
    const nextGameName = (gameName ?? target.gameName ?? '').toString().trim()
    const nextEmail = (email ?? target.email ?? '').toString().trim().toLowerCase()
    const nextPhone = (phone ?? target.phone ?? '').toString().trim()
    const nextLocation = (location ?? target.location ?? '').toString().trim()

    if (!nextName || !nextGameName || !nextEmail) {
      throw createHttpError(400, 'Name, game name, and email are required')
    }

    const conflict = await findIdentityConflict({
      email: nextEmail,
      gameName: nextGameName,
      excludeUserId: target.id,
    })
    if (conflict) {
      throw createHttpError(409, 'User already exists with same email or user id')
    }

    if (shouldUseDbAuth()) {
      const result = await dbQuery(
        `update users
         set name = $2,
             user_id = $3,
             game_name = $3,
             email = $4,
             phone = $5,
             location = $6,
             updated_at = now()
         where id = $1
         returning id, name, user_id, game_name, email, phone, location, password_hash, role, status,
                   contest_manager_contest_id, created_at, reset_token, reset_token_expires_at`,
        [target.id, nextName, nextGameName, nextEmail, nextPhone, nextLocation],
      )
      return mapDbUserToDomain(result.rows[0])
    }

    target.name = nextName
    target.userId = nextGameName
    target.gameName = nextGameName
    target.email = nextEmail
    target.phone = nextPhone
    target.location = nextLocation
    persistState()
    return target
  }

  return {
    registerUser,
    loginUser,
    refreshUserSession,
    forgotPassword,
    resetPassword,
    changePassword,
    approveUser,
    updateUserProfile,
  }
}

export { createAuthService, createHttpError }
