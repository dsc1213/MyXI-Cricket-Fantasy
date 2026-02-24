import bcrypt from 'bcryptjs'
import { getSeedUsers, getSeedMatchScores } from './services/seedStore.service.js'

const users = []
let nextUserId = 1
const tournaments = []
let nextTournamentId = 1
const matches = []
let nextMatchId = 1
const teamSelections = []
const scoringRules = []
let nextScoringRuleId = 1
const matchScores = []
let nextMatchScoreId = 1

const getNextUserId = () => nextUserId++
const getNextTournamentId = () => nextTournamentId++
const getNextMatchId = () => nextMatchId++
const getNextScoringRuleId = () => nextScoringRuleId++
const getNextMatchScoreId = () => nextMatchScoreId++
const defaultSecurityAnswersFor = (userId) => [
  `${userId}-school`,
  `${userId}-cricketer`,
  `${userId}-city`,
]

const syncIdCountersFromData = () => {
  nextUserId = Math.max(1, ...users.map((item) => Number(item.id) || 0)) + 1
  nextTournamentId =
    Math.max(1, ...tournaments.map((item) => Number(item.id) || 0)) + 1
  nextMatchId = Math.max(1, ...matches.map((item) => Number(item.id) || 0)) + 1
  nextScoringRuleId =
    Math.max(1, ...scoringRules.map((item) => Number(item.id) || 0)) + 1
  nextMatchScoreId =
    Math.max(1, ...matchScores.map((item) => Number(item.id) || 0)) + 1
}

const getUserById = (id) => users.find((user) => user.id === id) || null
const normalizeUserIdentifier = (value) => (value || '').toString().trim()
const syncUserIdentifiers = () => {
  users.forEach((user) => {
    const fromUserId = normalizeUserIdentifier(user.userId)
    const fromGameName = normalizeUserIdentifier(user.gameName)
    const normalized = fromUserId || fromGameName
    if (!normalized) return
    user.userId = normalized
    user.gameName = normalized
  })
}

const seedMasterAdmin = () => {
  const email = process.env.MASTER_ADMIN_EMAIL
  const password = process.env.MASTER_ADMIN_PASSWORD
  const name = process.env.MASTER_ADMIN_NAME || 'Master Admin'
  const defaultUserIdFromEmail = (email || '').split('@')[0] || 'admin'
  const userId = process.env.MASTER_ADMIN_USER_ID || defaultUserIdFromEmail
  if (!email || !password) return
  const existing = users.find((user) => user.email === email)
  if (existing) return
  const passwordHash = bcrypt.hashSync(password, 10)
  users.push({
    id: getNextUserId(),
    name,
    userId,
    gameName: userId,
    email,
    passwordHash,
    status: 'active',
    role: 'master_admin',
    createdAt: new Date().toISOString(),
  })
}

const seedInitialUsers = () => {
  getSeedUsers().forEach((item) => {
    const existing = users.find((user) => user.email === item.email)
    if (existing) return
    const normalizedUserId = normalizeUserIdentifier(item.userId || item.gameName)
    const securityAnswers = Array.isArray(item.securityAnswers)
      ? item.securityAnswers
      : defaultSecurityAnswersFor(normalizedUserId)
    const [answer1, answer2, answer3] = securityAnswers
    users.push({
      id: item.id,
      name: item.name,
      userId: normalizedUserId,
      gameName: normalizedUserId,
      email: item.email,
      phone: (item.phone || '').toString().trim(),
      passwordHash: bcrypt.hashSync(item.password, 10),
      securityAnswer1Hash: bcrypt.hashSync((answer1 || '').toString().trim().toLowerCase(), 10),
      securityAnswer2Hash: bcrypt.hashSync((answer2 || '').toString().trim().toLowerCase(), 10),
      securityAnswer3Hash: bcrypt.hashSync((answer3 || '').toString().trim().toLowerCase(), 10),
      status: item.status,
      role: item.role,
      contestManagerContestId: item.contestManagerContestId || null,
      createdAt: new Date().toISOString(),
    })
    if (item.id >= nextUserId) {
      nextUserId = item.id + 1
    }
  })
}

const resetStore = () => {
  users.length = 0
  tournaments.length = 0
  matches.length = 0
  teamSelections.length = 0
  scoringRules.length = 0
  matchScores.length = 0
  nextUserId = 1
  nextTournamentId = 1
  nextMatchId = 1
  nextScoringRuleId = 1
  nextMatchScoreId = 1
  seedMasterAdmin()
  seedInitialUsers()
  getSeedMatchScores().forEach((row) => {
    matchScores.push({
      ...row,
      active: row.active !== false,
      playerStats: Array.isArray(row.playerStats) ? row.playerStats : [],
    })
  })
  syncUserIdentifiers()
  syncIdCountersFromData()
}

export {
  users,
  tournaments,
  matches,
  teamSelections,
  scoringRules,
  matchScores,
  getNextUserId,
  getNextTournamentId,
  getNextMatchId,
  getNextScoringRuleId,
  getNextMatchScoreId,
  getUserById,
  syncUserIdentifiers,
  seedMasterAdmin,
  seedInitialUsers,
  syncIdCountersFromData,
  resetStore,
}
