const normalizeRole = (role) => {
  if (role === 'master') return 'master_admin'
  if (role === 'player' || role === 'default') return 'user'
  return role
}

const mapDbUserToDomain = (row) => {
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
    contestManagerContestId: row.contest_manager_contest_id || null,
    status: row.status,
    createdAt: row.created_at,
    resetToken: row.reset_token || null,
    resetTokenExpiresAt: row.reset_token_expires_at || null,
    securityAnswer1Hash: row.security_answer_1_hash || null,
    securityAnswer2Hash: row.security_answer_2_hash || null,
    securityAnswer3Hash: row.security_answer_3_hash || null,
  }
}

const mapUserToPublic = (user) => ({
  id: user.id,
  name: user.name,
  userId: user.userId || user.gameName,
  gameName: user.gameName,
  email: user.email,
  phone: user.phone || '',
  location: user.location || '',
  contestManagerContestId: user.contestManagerContestId || null,
  status: user.status,
})

const mapAuthSessionResponse = ({ user, role, token, tokenExpiresAt, ok = false }) => ({
  ...(ok ? { ok: true } : {}),
  ...mapUserToPublic(user),
  role,
  token,
  tokenExpiresAt,
})

export { normalizeRole, mapDbUserToDomain, mapUserToPublic, mapAuthSessionResponse }
