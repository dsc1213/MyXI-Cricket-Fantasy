import { dbQuery, shouldUsePostgres } from '../db.js'
import { mapDbUserToDomain, normalizeRole } from '../helpers/authHelpers.js'
import { createRepositoryFactory } from '../repositories/repository.factory.js'

const factory = createRepositoryFactory()

const createHttpError = (statusCode, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const SECURITY_QUESTIONS = [
  { key: 'q1', prompt: 'What was your first school name?' },
  { key: 'q2', prompt: 'Who is your favorite cricketer?' },
  { key: 'q3', prompt: 'What city were you born in?' },
]

// Validates and normalizes security answers (array or object). Throws 400 if invalid.
function requireValidSecurityAnswers(input) {
  let arr = []
  if (Array.isArray(input)) {
    arr = input.map((v) => (v || '').toString().trim().toLowerCase())
  } else if (input && typeof input === 'object') {
    arr = [input.q1, input.q2, input.q3].map((v) =>
      (v || '').toString().trim().toLowerCase(),
    )
  }
  if (arr.length !== 3 || arr.some((v) => !v)) {
    const error = new Error('All 3 security answers are required')
    error.statusCode = 400
    throw error
  }
  return arr
}

const createAuthService = ({ bcrypt, jwt, jwtSecret, jwtExpiresIn, appendAuditLog }) => {
  const normalizeIdentity = (value) => (value || '').toString().trim().toLowerCase()
  const normalizeSecurityAnswer = (value) => (value || '').toString().trim().toLowerCase()
  const normalizeSecurityAnswersPayload = (payload) => {
    if (Array.isArray(payload)) {
      return payload.slice(0, 3).map((item) => normalizeSecurityAnswer(item))
    }
    if (payload && typeof payload === 'object') {
      return [
        normalizeSecurityAnswer(payload.q1),
        normalizeSecurityAnswer(payload.q2),
        normalizeSecurityAnswer(payload.q3),
      ]
    }
    return []
  }
  const getSecurityAnswerHashesFromUser = (user) => [
    user?.securityAnswer1Hash || user?.security_answer_1_hash || null,
    user?.securityAnswer2Hash || user?.security_answer_2_hash || null,
    user?.securityAnswer3Hash || user?.security_answer_3_hash || null,
  ]
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

    const masterIdentities = new Set([
      'master',
      'master@myxi.local',
      'sreecharan',
      'sree@myxi.local',
    ])
    const adminIdentities = new Set([
      'admin',
      'admin@myxi.local',
      'rahulxi',
      'rahul@myxi.local',
    ])
    const contestManagerIdentities = new Set(['contestmgr', 'contestmgr@myxi.local'])

    if (masterAdminEmail && identityValues.includes(masterAdminEmail))
      return 'master_admin'
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
    const repo = await factory.getUserRepository()
    const normalizedEmail = normalizeIdentity(email)
    const normalizedGameName = normalizeIdentity(gameName)

    const existingEmail = normalizedEmail ? await repo.findByEmail(normalizedEmail) : null
    const existingGameName = normalizedGameName
      ? await repo.findByGameName(normalizedGameName)
      : null

    const conflict = existingEmail || existingGameName
    if (!conflict) return null

    // Check exclude
    if (excludeUserId != null && Number(conflict.id) === Number(excludeUserId))
      return null

    return conflict
  }
  const findUserByIdentifier = async (identifier = '') => {
    const input = normalizeIdentity(identifier)
    if (!input) return null
    const repo = await factory.getUserRepository()
    return await repo.findByIdentifier(input)
  }
  const findUserById = async (id) => {
    const numericId = Number(id)
    if (!Number.isFinite(numericId) || numericId <= 0) return null
    const repo = await factory.getUserRepository()
    return await repo.findById(numericId)
  }

  const registerUser = async ({
    name,
    userId,
    gameName,
    location,
    email,
    phone,
    password,
    securityAnswers,
  }) => {
    const requestedUserId = (userId || gameName || '').toString().trim()
    if (!name || !requestedUserId || !email || !password) {
      throw createHttpError(400, 'Missing required fields')
    }
    const normalizedEmail = email.toString().trim().toLowerCase()

    const repo = await factory.getUserRepository()
    const existingEmail = await repo.findByEmail(normalizedEmail)
    const existingGameName = await repo.findByGameName(requestedUserId)
    if (existingEmail || existingGameName) {
      throw createHttpError(409, 'User already exists with same email or user id')
    }

    const passwordHash = bcrypt.hashSync(password, 10)
    const normalizedAnswers = requireValidSecurityAnswers(securityAnswers)
    const securityAnswerHashes = normalizedAnswers.map((item) =>
      bcrypt.hashSync(item, 10),
    )

    const userData = {
      name: name.toString().trim(),
      userId: requestedUserId,
      gameName: requestedUserId,
      location: (location || '').toString().trim(),
      email: normalizedEmail,
      phone: (phone || '').toString().trim(),
      passwordHash,
      securityAnswer1Hash: securityAnswerHashes[0],
      securityAnswer2Hash: securityAnswerHashes[1],
      securityAnswer3Hash: securityAnswerHashes[2],
      securityAnswers: normalizedAnswers,
      status: 'pending',
      role: 'user',
    }
    const createdUser = await repo.createUser(userData)
    return createdUser
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
        throw createHttpError(
          403,
          'User not approved yet. Wait for master admin approval.',
        )
      }
      if (user.status === 'rejected') {
        throw createHttpError(403, 'User registration was rejected.')
      }
      throw createHttpError(403, 'User is not active.')
    }

    const repo = await factory.getUserRepository()
    let normalizedRole = normalizeRole(user.role)
    const inferredRole = inferPrivilegedRole({ user, identifier: input })
    if (inferredRole && normalizedRole === 'user') {
      normalizedRole = inferredRole
      const nextContestScope =
        inferredRole === 'contest_manager' && !user.contestManagerContestId
          ? 'huntercherry'
          : user.contestManagerContestId
      await repo.update(user.id, {
        role: inferredRole,
        contestManagerContestId: nextContestScope,
      })
      user.role = inferredRole
      user.contestManagerContestId = nextContestScope
    } else if (normalizedRole !== user.role) {
      await repo.update(user.id, { role: normalizedRole })
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

  const getUserStatus = async ({ userId, email }) => {
    const identifier = (email || userId || '').toString().trim().toLowerCase()
    if (!identifier) throw createHttpError(400, 'Missing required fields')
    const user = await findUserByIdentifier(identifier)
    if (!user) throw createHttpError(404, 'User not found')
    return {
      id: user.id,
      userId: user.userId || user.gameName,
      gameName: user.gameName,
      email: user.email,
      status: user.status,
      role: normalizeRole(user.role),
      contestManagerContestId: user.contestManagerContestId || null,
    }
  }

  const forgotPassword = async ({ userId, email }) => {
    const identifier = (email || userId || '').toString().trim().toLowerCase()
    if (!identifier) throw createHttpError(400, 'Missing required fields')
    const user = await findUserByIdentifier(identifier)
    if (!user) throw createHttpError(404, 'User not found')
    const hashes = getSecurityAnswerHashesFromUser(user)
    if (hashes.some((value) => !value)) {
      throw createHttpError(400, 'Security questions are not configured for this account')
    }
    return {
      ok: true,
      message: 'Security questions loaded. Submit correct answers to reset password.',
      questions: SECURITY_QUESTIONS,
    }
  }

  const resetPassword = async ({ userId, email, answers, newPassword }) => {
    const identifier = (email || userId || '').toString().trim().toLowerCase()
    if (!identifier || !newPassword) throw createHttpError(400, 'Missing required fields')
    if (newPassword.length < 6)
      throw createHttpError(400, 'Password must be at least 6 characters')
    const user = await findUserByIdentifier(identifier)
    if (!user) throw createHttpError(404, 'User not found')
    const normalizedAnswers = requireValidSecurityAnswers(answers)
    const answerHashes = getSecurityAnswerHashesFromUser(user)
    if (
      answerHashes.length !== 3 ||
      answerHashes.some((value) => !value) ||
      !normalizedAnswers.every((value, index) =>
        bcrypt.compareSync(value, answerHashes[index]),
      )
    ) {
      throw createHttpError(401, 'Security answers do not match')
    }

    const repo = await factory.getUserRepository()
    await repo.updatePassword(user.id, bcrypt.hashSync(newPassword, 10))
    return { ok: true, message: 'Password updated successfully' }
  }

  const changePassword = async ({ user, currentPassword, newPassword }) => {
    if (!currentPassword || !newPassword)
      throw createHttpError(400, 'Missing required fields')
    if (newPassword.length < 6)
      throw createHttpError(400, 'Password must be at least 6 characters')
    if (user?.id == null) throw createHttpError(401, 'Unauthorized')
    let targetUser = user
    if (!targetUser?.passwordHash && targetUser?.id != null) {
      targetUser = await findUserById(targetUser.id)
    }
    if (
      !targetUser?.passwordHash ||
      !bcrypt.compareSync(currentPassword, targetUser.passwordHash)
    ) {
      throw createHttpError(401, 'Current password is incorrect')
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10)
    // Always use the repository for updating password (mock or db)
    const repo = await factory.getUserRepository()
    await repo.updatePassword(targetUser.id, passwordHash)
    return { ok: true, message: 'Password updated successfully' }
  }

  const approveUser = async ({ userId, status }) => {
    if (!userId || !status) throw createHttpError(400, 'Missing required fields')
    if (!['active', 'rejected'].includes(status))
      throw createHttpError(400, 'Invalid status')

    const repo = await factory.getUserRepository()
    const user = await repo.findById(Number(userId))
    if (!user) throw createHttpError(404, 'User not found')
    if (user.role === 'master_admin')
      throw createHttpError(400, 'Cannot modify master admin')

    await repo.update(user.id, { status })
    return { id: user.id, status }
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

    const repo = await factory.getUserRepository()
    await repo.update(target.id, {
      name: nextName,
      userId: nextGameName,
      gameName: nextGameName,
      email: nextEmail,
      phone: nextPhone,
      location: nextLocation,
    })
    return await repo.findById(target.id)
  }

  return {
    registerUser,
    loginUser,
    refreshUserSession,
    getUserStatus,
    forgotPassword,
    resetPassword,
    changePassword,
    approveUser,
    updateUserProfile,
  }
}

export { createAuthService, createHttpError }
