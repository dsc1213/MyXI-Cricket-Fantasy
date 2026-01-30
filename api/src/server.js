import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { buildAuth } from './middleware/auth.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 4000
const jwtSecret = process.env.JWT_SECRET || 'dev-secret'
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d'

app.use(cors())
app.use(express.json())

const users = []
let nextUserId = 1
const tournaments = []
let nextTournamentId = 1
const matches = []
let nextMatchId = 1
const teamSelections = []

const resetStore = () => {
  users.length = 0
  tournaments.length = 0
  matches.length = 0
  teamSelections.length = 0
  nextUserId = 1
  nextTournamentId = 1
  nextMatchId = 1
  seedMasterAdmin()
}


const seedMasterAdmin = () => {
  const email = process.env.MASTER_ADMIN_EMAIL
  const password = process.env.MASTER_ADMIN_PASSWORD
  const name = process.env.MASTER_ADMIN_NAME || 'Master Admin'
  if (!email || !password) {
    return
  }
  const existing = users.find((user) => user.email === email)
  if (existing) {
    return
  }
  const passwordHash = bcrypt.hashSync(password, 10)
  users.push({
    id: nextUserId++,
    name,
    email,
    passwordHash,
    status: 'active',
    role: 'master_admin',
    createdAt: new Date().toISOString(),
  })
}

seedMasterAdmin()

const getUserById = (id) => users.find((user) => user.id === id) || null
const { authenticate, requireRole } = buildAuth({ getUserById, jwtSecret })

const canManageUser = (currentUser, targetUser) => {
  if (!currentUser || !targetUser) return false
  if (currentUser.role === 'master_admin') return true
  if (currentUser.role === 'admin') {
    return targetUser.role !== 'master_admin'
  }
  return currentUser.id === targetUser.id
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/auth/register', (req, res) => {
  const { name, gameName, email, password } = req.body || {}
  if (!name || !gameName || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' })
  }
  const existing = users.find((user) => user.email === email)
  if (existing) {
    return res.status(409).json({ message: 'User already exists' })
  }
  const passwordHash = bcrypt.hashSync(password, 10)
  const user = {
    id: nextUserId++,
    name,
    gameName,
    email,
    passwordHash,
    status: 'pending',
    role: 'user',
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  return res.status(201).json({
    id: user.id,
    name: user.name,
    gameName: user.gameName,
    email: user.email,
    status: user.status,
  })
})

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ message: 'Missing required fields' })
  }
  const user = users.find((item) => item.email === email)
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }
  const isValid = bcrypt.compareSync(password, user.passwordHash)
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }
  if (user.status !== 'active') {
    return res.status(403).json({ message: 'Account not approved' })
  }
  const token = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    jwtSecret,
    { expiresIn: jwtExpiresIn },
  )
  return res.json({
    id: user.id,
    name: user.name,
    gameName: user.gameName,
    role: user.role,
    status: user.status,
    token,
  })
})

app.post('/auth/approve-user', requireRole(['master_admin']), (req, res) => {
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
  return res.json({ id: user.id, status: user.status })
})

app.get('/admin/tournaments', requireRole(['admin', 'master_admin']), (req, res) => {
  return res.json(tournaments)
})

app.post(
  '/admin/tournaments/select',
  requireRole(['admin', 'master_admin']),
  (req, res) => {
    const { name, season, sourceKey } = req.body || {}
    if (!name || !season || !sourceKey) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    const exists = tournaments.find(
      (t) => t.sourceKey === sourceKey && t.season === season,
    )
    if (exists) {
      return res.status(409).json({ message: 'Tournament already exists' })
    }
    const tournament = {
      id: nextTournamentId++,
      name,
      season,
      sourceKey,
      status: 'active',
      createdBy: req.currentUser.id,
      createdAt: new Date().toISOString(),
    }
    tournaments.push(tournament)
    return res.status(201).json(tournament)
  },
)

app.post(
  '/admin/matches/import-fixtures',
  requireRole(['admin', 'master_admin']),
  (req, res) => {
    const { tournamentId, fixtures } = req.body || {}
    const target = tournaments.find((t) => t.id === Number(tournamentId))
    if (!target) {
      return res.status(404).json({ message: 'Tournament not found' })
    }
    if (!Array.isArray(fixtures) || fixtures.length === 0) {
      return res.status(400).json({ message: 'Fixtures required' })
    }
    const created = []
    fixtures.forEach((fixture) => {
      const { name, teamA, teamB, startTime } = fixture || {}
      if (!name || !teamA || !teamB || !startTime) {
        return
      }
      const match = {
        id: nextMatchId++,
        tournamentId: target.id,
        name,
        teamA,
        teamB,
        startTime,
        status: 'scheduled',
      }
      matches.push(match)
      created.push(match)
    })
    return res.status(201).json({ created })
  },
)

app.patch(
  '/admin/matches/:id/status',
  requireRole(['admin', 'master_admin']),
  (req, res) => {
    const matchId = Number(req.params.id)
    if (Number.isNaN(matchId)) {
      return res.status(400).json({ message: 'Invalid match id' })
    }
    const { status } = req.body || {}
    if (!['scheduled', 'live', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }
    const match = matches.find((m) => m.id === matchId)
    if (!match) {
      return res.status(404).json({ message: 'Match not found' })
    }
    match.status = status
    return res.json(match)
  },
)

app.get('/tournaments', (req, res) => {
  return res.json(
    tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      season: t.season,
      status: t.status,
    })),
  )
})

app.get('/tournaments/:id/matches', (req, res) => {
  const tournamentId = Number(req.params.id)
  if (Number.isNaN(tournamentId)) {
    return res.status(400).json({ message: 'Invalid tournament id' })
  }
  const list = matches.filter((m) => m.tournamentId === tournamentId)
  return res.json(list)
})

app.post('/matches/:id/team', authenticate, (req, res) => {
  const currentUser = req.currentUser
  const matchId = Number(req.params.id)
  if (Number.isNaN(matchId)) {
    return res.status(400).json({ message: 'Invalid match id' })
  }
  const match = matches.find((m) => m.id === matchId)
  if (!match) {
    return res.status(404).json({ message: 'Match not found' })
  }
  const { playingXi, backups } = req.body || {}
  if (!Array.isArray(playingXi) || playingXi.length !== 11) {
    return res.status(400).json({ message: 'playingXi must be 11 items' })
  }
  if (backups && (!Array.isArray(backups) || backups.length > 6)) {
    return res.status(400).json({ message: 'backups must be 0-6 items' })
  }
  const existing = teamSelections.find(
    (t) => t.matchId === matchId && t.userId === currentUser.id,
  )
  const payload = {
    matchId,
    userId: currentUser.id,
    playingXi,
    backups: backups || [],
    updatedAt: new Date().toISOString(),
  }
  if (existing) {
    Object.assign(existing, payload)
  } else {
    teamSelections.push(payload)
  }
  return res.json(payload)
})

app.post(
  '/admin/matches/:id/auto-swap',
  requireRole(['admin', 'master_admin']),
  (req, res) => {
    const matchId = Number(req.params.id)
    if (Number.isNaN(matchId)) {
      return res.status(400).json({ message: 'Invalid match id' })
    }
    const match = matches.find((m) => m.id === matchId)
    if (!match) {
      return res.status(404).json({ message: 'Match not found' })
    }
    const { playingXiConfirmed } = req.body || {}
    if (!Array.isArray(playingXiConfirmed)) {
      return res.status(400).json({ message: 'playingXiConfirmed required' })
    }
    const updates = []
    teamSelections
      .filter((t) => t.matchId === matchId)
      .forEach((selection) => {
        const updatedPlaying = [...selection.playingXi]
        const backups = [...selection.backups]
        for (let i = 0; i < updatedPlaying.length; i += 1) {
          const playerId = updatedPlaying[i]
          if (!playingXiConfirmed.includes(playerId) && backups.length > 0) {
            updatedPlaying[i] = backups.shift()
          }
        }
        selection.playingXi = updatedPlaying
        selection.backups = backups
        selection.updatedAt = new Date().toISOString()
        updates.push({
          userId: selection.userId,
          playingXi: updatedPlaying,
          backups,
        })
      })
    return res.json({ updated: updates.length, updates })
  },
)

app.get('/users', requireRole(['admin', 'master_admin']), (req, res) => {
  const query = (req.query.q || '').toString().toLowerCase()
  const list = query
    ? users.filter((user) => {
        return (
          user.name.toLowerCase().includes(query) ||
          user.gameName.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        )
      })
    : users
  return res.json(
    list.map((user) => ({
      id: user.id,
      name: user.name,
      gameName: user.gameName,
      email: user.email,
      status: user.status,
      role: user.role,
    })),
  )
})

app.patch('/users/:id', authenticate, (req, res) => {
  const currentUser = req.currentUser
  const userId = Number(req.params.id)
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Invalid user id' })
  }
  const targetUser = users.find((user) => user.id === userId)
  if (!targetUser) {
    return res.status(404).json({ message: 'User not found' })
  }
  if (!canManageUser(currentUser, targetUser)) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const { name, gameName, status, role, email, password } = req.body || {}
  if (typeof name === 'string' && name.trim()) {
    targetUser.name = name.trim()
  }
  if (typeof gameName === 'string' && gameName.trim()) {
    targetUser.gameName = gameName.trim()
  }
  if (typeof email === 'string' && email.trim()) {
    targetUser.email = email.trim().toLowerCase()
  }

  const canAdminUpdate = ['admin', 'master_admin'].includes(currentUser.role)
  if (canAdminUpdate && typeof status === 'string') {
    if (['pending', 'active', 'rejected'].includes(status)) {
      targetUser.status = status
    }
  }
  if (currentUser.role === 'master_admin' && typeof role === 'string') {
    if (['user', 'admin', 'master_admin'].includes(role)) {
      if (targetUser.role !== 'master_admin' || role === 'master_admin') {
        targetUser.role = role
      }
    }
  }
  if (typeof password === 'string' && password.length >= 6) {
    targetUser.passwordHash = bcrypt.hashSync(password, 10)
  }

  return res.json({
    id: targetUser.id,
    name: targetUser.name,
    gameName: targetUser.gameName,
    email: targetUser.email,
    status: targetUser.status,
    role: targetUser.role,
  })
})


app.delete('/users/:id', requireRole(['master_admin']), (req, res) => {
  const userId = Number(req.params.id)
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Invalid user id' })
  }
  const index = users.findIndex((user) => user.id === userId)
  if (index == -1) {
    return res.status(404).json({ message: 'User not found' })
  }
  if (users[index].role === 'master_admin') {
    return res.status(400).json({ message: 'Cannot delete master admin' })
  }
  const removed = users.splice(index, 1)[0]
  return res.json({ id: removed.id, deleted: true })
})


export { app, resetStore }
