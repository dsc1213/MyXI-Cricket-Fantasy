// Mock repository wraps mockProviderContext data for users
class UserMockRepository {
  constructor(context) {
    // Use the shared users array from context for persistence
    this.context = context
    this.users = context.users
    this.getNextUserId = context.getNextUserId || (() => this.users.length + 1)

    // Auto-hash plain 'password' fields to 'passwordHash' for all users
    const bcrypt = this.context.bcrypt || globalThis.bcrypt
    if (bcrypt && typeof bcrypt.hashSync === 'function') {
      for (const user of this.users) {
        if (user.password && !user.passwordHash) {
          user.passwordHash = bcrypt.hashSync(user.password, 10)
        }
      }
    }
  }

  _matchesId(user, id) {
    return String(user?.id) === String(id) || String(user?.userId) === String(id)
  }

  async delete(id) {
    const idx = this.users.findIndex((u) => this._matchesId(u, id))
    if (idx === -1) return null
    const [deleted] = this.users.splice(idx, 1)
    this.context.persistState?.()
    return this._toDto(deleted)
  }

  async findAll(opts = {}) {
    let results = [...this.users]

    if (opts.search) {
      const q = opts.search.toLowerCase()
      results = results.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.gameName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q),
      )
    }

    if (opts.role) {
      results = results.filter((u) => u.role === opts.role)
    }

    if (opts.status) {
      results = results.filter((u) => u.status === opts.status)
    }

    return results.map((u) => this._toDto(u))
  }

  async findById(id) {
    const u = this.users.find((item) => this._matchesId(item, id))
    if (!u) return null
    return this._toDto(u)
  }

  async update(id, data) {
    const u = this.users.find((item) => this._matchesId(item, id))
    if (!u) return null

    if (data.name !== undefined) u.name = data.name
    if (data.userId !== undefined) u.userId = data.userId
    if (data.gameName !== undefined) u.gameName = data.gameName
    if (data.email !== undefined) u.email = data.email
    if (data.phone !== undefined) u.phone = data.phone
    if (data.location !== undefined) u.location = data.location
    if (data.status !== undefined) u.status = data.status
    if (data.role !== undefined) u.role = data.role
    if (data.contestManagerContestId !== undefined)
      u.contestManagerContestId = data.contestManagerContestId
    u.updatedAt = new Date().toISOString()

    return this._toDto(u)
  }

  async findByEmail(email) {
    const u = this.users.find(
      (item) => item.email?.toLowerCase() === email?.toLowerCase(),
    )
    if (!u) return null
    return this._toDto(u)
  }

  async findByGameName(gameName) {
    const u = this.users.find(
      (item) => item.gameName?.toLowerCase() === gameName?.toLowerCase(),
    )
    if (!u) return null
    return this._toDto(u)
  }

  async createUser(userData) {
    const id = this.getNextUserId()
    // Hash security answers if not already hashed
    const bcrypt = this.context.bcrypt || globalThis.bcrypt
    let s1 = userData.securityAnswer1Hash,
      s2 = userData.securityAnswer2Hash,
      s3 = userData.securityAnswer3Hash
    if ((!s1 || !s2 || !s3) && Array.isArray(userData.securityAnswers)) {
      if (bcrypt && typeof bcrypt.hashSync === 'function') {
        ;[s1, s2, s3] = userData.securityAnswers.map((ans) => bcrypt.hashSync(ans, 10))
      } else {
        ;[s1, s2, s3] = userData.securityAnswers
      }
    }
    const user = {
      id,
      name: userData.name,
      userId: userData.userId,
      gameName: userData.gameName,
      email: userData.email,
      phone: userData.phone,
      location: userData.location,
      passwordHash: userData.passwordHash,
      role: userData.role || 'user',
      status: userData.status || 'active',
      contestManagerContestId: userData.contestManagerContestId,
      securityAnswer1Hash: s1 || null,
      securityAnswer2Hash: s2 || null,
      securityAnswer3Hash: s3 || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.users.push(user)
    this.context.persistState?.()
    return this._toDto(user)
  }

  async updatePassword(id, passwordHash) {
    const u = this.users.find((item) => this._matchesId(item, id))
    if (!u) return false
    u.passwordHash = passwordHash
    u.updatedAt = new Date().toISOString()
    return true
  }

  async updateResetToken(id, resetToken, resetTokenExpiresAt) {
    const u = this.users.find((item) => this._matchesId(item, id))
    if (!u) return false
    u.resetToken = resetToken
    u.resetTokenExpiresAt = resetTokenExpiresAt
    u.updatedAt = new Date().toISOString()
    this.context.persistState?.()
    return true
  }

  async findByIdentifier(identifier) {
    const input = identifier?.toLowerCase()
    const u = this.users.find(
      (item) =>
        item.email?.toLowerCase() === input ||
        item.userId?.toLowerCase() === input ||
        item.gameName?.toLowerCase() === input,
    )
    if (!u) return null
    return this._toDto(u)
  }

  _toDto(user) {
    return {
      id: user.id,
      name: user.name,
      userId: user.userId,
      gameName: user.gameName,
      email: user.email,
      phone: user.phone,
      location: user.location,
      passwordHash: user.passwordHash,
      role: user.role || 'user',
      status: user.status || 'active',
      contestManagerContestId: user.contestManagerContestId,
      securityAnswer1Hash: user.securityAnswer1Hash || null,
      securityAnswer2Hash: user.securityAnswer2Hash || null,
      securityAnswer3Hash: user.securityAnswer3Hash || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      resetToken: user.resetToken,
      resetTokenExpiresAt: user.resetTokenExpiresAt,
    }
  }
}

export { UserMockRepository }
