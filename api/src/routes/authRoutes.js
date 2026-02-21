const registerAuthRoutes = (
  router,
  {
    users,
    bcrypt,
    jwt,
    jwtSecret,
    jwtExpiresIn,
    getNextUserId,
    authenticate,
    requireRole,
    persistMock,
    appendAuditLog,
  },
) => {
  const normalizeIdentity = (value) => (value || '').toString().trim().toLowerCase()
  const findIdentityConflict = ({ email, gameName, excludeUserId = null }) => {
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
  const cookieBaseOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }
  const normalizeRole = (role) => {
    if (role === 'master') return 'master_admin'
    if (role === 'player' || role === 'default') return 'user'
    return role
  }
  const hasIdentity = (identitySet, values = []) =>
    values.some((value) => value && identitySet.has(value))
  const inferPrivilegedRole = ({ user, identifier }) => {
    const identityValues = [
      identifier,
      user?.userId,
      user?.gameName,
      user?.email,
    ]
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
    const contestManagerIdentities = new Set([
      'contestmgr',
      'contestmgr@myxi.local',
    ])

    if (masterAdminEmail && identityValues.includes(masterAdminEmail)) {
      return 'master_admin'
    }
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
  const buildAuthResponse = (user, role, token, tokenExpiresAt) => ({
    id: user.id,
    name: user.name,
    userId: user.userId || user.gameName,
    gameName: user.gameName,
    email: user.email,
    phone: user.phone || '',
    location: user.location || '',
    role,
    contestManagerContestId: user.contestManagerContestId || null,
    status: user.status,
    token,
    tokenExpiresAt,
  })

  router.get('/health', (req, res) => {
    res.json({ status: 'ok' })
  })

  router.post('/auth/register', (req, res) => {
    const { name, userId, gameName, location, email, phone, password } = req.body || {}
    const requestedUserId = (userId || gameName || '').toString().trim()
    if (!name || !requestedUserId || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    const normalizedGameName = requestedUserId
    const normalizedEmail = email.toString().trim().toLowerCase()
    const existing = findIdentityConflict({
      email: normalizedEmail,
      gameName: normalizedGameName,
    })
    if (existing) {
      return res
        .status(409)
        .json({ message: 'User already exists with same email or user id' })
    }
    const passwordHash = bcrypt.hashSync(password, 10)
    const user = {
      id: getNextUserId(),
      name: name.toString().trim(),
      userId: normalizedGameName,
      gameName: normalizedGameName,
      location: (location || '').toString().trim(),
      email: normalizedEmail,
      phone: (phone || '').toString().trim(),
      passwordHash,
      status: 'pending',
      role: 'user',
      createdAt: new Date().toISOString(),
    }
    users.push(user)
    persistMock()
    return res.status(201).json({
      id: user.id,
      name: user.name,
      userId: user.userId || user.gameName,
      gameName: user.gameName,
      location: user.location || '',
      email: user.email,
      phone: user.phone || '',
      status: user.status,
    })
  })

  router.post('/auth/login', (req, res) => {
    const { email, userId, password } = req.body || {}
    const identifier = email || userId
    if (!identifier) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    if (!password) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    const input = identifier.toLowerCase().trim()
    const user = users.find((item) => {
      return (
        item.email?.toLowerCase() === input ||
        item.userId?.toLowerCase() === input ||
        item.gameName?.toLowerCase() === input
      )
    })
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    const hasPasswordHash = Boolean(user.passwordHash)
    if (!hasPasswordHash || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }
    if (user.status !== 'active') {
      if (user.status === 'pending') {
        return res
          .status(403)
          .json({ message: 'User not approved yet. Wait for master admin approval.' })
      }
      if (user.status === 'rejected') {
        return res.status(403).json({ message: 'User registration was rejected.' })
      }
      return res.status(403).json({ message: 'User is not active.' })
    }
    let normalizedRole = normalizeRole(user.role)
    const inferredRole = inferPrivilegedRole({ user, identifier: input })
    if (inferredRole && normalizedRole === 'user') {
      normalizedRole = inferredRole
      user.role = inferredRole
      if (inferredRole === 'contest_manager' && !user.contestManagerContestId) {
        user.contestManagerContestId = 'huntercherry'
      }
      persistMock()
    } else if (normalizedRole !== user.role) {
      user.role = normalizedRole
      persistMock()
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
    res.cookie('myxi_auth', token, {
      ...cookieBaseOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    return res.json(buildAuthResponse(user, normalizedRole, token, tokenExpiresAt))
  })

  router.post('/auth/logout', (req, res) => {
    res.clearCookie('myxi_auth', cookieBaseOptions)
    return res.json({ ok: true })
  })

  router.post('/auth/refresh', authenticate, (req, res) => {
    const user = req.currentUser
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    const role = normalizeRole(user.role)
    const { token, tokenExpiresAt } = issueSessionToken(user, role)
    res.cookie('myxi_auth', token, {
      ...cookieBaseOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    return res.json({
      ok: true,
      ...buildAuthResponse(user, role, token, tokenExpiresAt),
    })
  })

  router.post('/auth/forgot-password', (req, res) => {
    const { userId, email } = req.body || {}
    const identifier = (email || userId || '').toString().trim().toLowerCase()
    if (!identifier) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    const user = users.find(
      (item) =>
        item.email?.toLowerCase() === identifier ||
        item.userId?.toLowerCase() === identifier ||
        item.gameName?.toLowerCase() === identifier,
    )
    if (!user) {
      return res.json({
        ok: true,
        message:
          'If the account exists, a reset token has been generated in mock mode.',
      })
    }
    const token = `rst_${Math.random().toString(36).slice(2, 10)}${Date.now()
      .toString(36)
      .slice(-6)}`
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    user.resetToken = token
    user.resetTokenExpiresAt = expiresAt
    persistMock()
    return res.json({
      ok: true,
      message: 'Reset token generated. Use it to set a new password.',
      resetToken: token,
      expiresAt,
    })
  })

  router.post('/auth/reset-password', (req, res) => {
    const { token, newPassword } = req.body || {}
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 6 characters' })
    }
    const user = users.find((item) => item.resetToken === token)
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' })
    }
    const expiryTime = new Date(user.resetTokenExpiresAt || '').getTime()
    if (!expiryTime || Number.isNaN(expiryTime) || expiryTime < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired reset token' })
    }
    user.passwordHash = bcrypt.hashSync(newPassword, 10)
    delete user.resetToken
    delete user.resetTokenExpiresAt
    persistMock()
    return res.json({ ok: true, message: 'Password updated successfully' })
  })

  router.post('/auth/change-password', authenticate, (req, res) => {
    const { currentPassword, newPassword } = req.body || {}
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 6 characters' })
    }
    const user = req.currentUser
    if (!user?.passwordHash || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }
    user.passwordHash = bcrypt.hashSync(newPassword, 10)
    persistMock()
    return res.json({ ok: true, message: 'Password updated successfully' })
  })

  router.post('/auth/approve-user', requireRole(['master_admin']), (req, res) => {
    const { userId, status } = req.body || {}
    if (!userId || !status) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    if (!['active', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }
    const user = users.find((item) => item.id === Number(userId))
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }
    if (user.role === 'master_admin') {
      return res.status(400).json({ message: 'Cannot modify master admin' })
    }
    user.status = status
    persistMock()
    return res.json({ id: user.id, status: user.status })
  })
}

export { registerAuthRoutes }
