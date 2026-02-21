const registerCoreRoutes = (
  router,
  {
    authenticate,
    requireRole,
    users,
    tournaments,
    matches,
    teamSelections,
    scoringRules,
    matchScores,
    getNextTournamentId,
    getNextMatchId,
    getNextScoringRuleId,
    getNextMatchScoreId,
    canManageUser,
    getRulesForTournament,
    calculatePoints,
    bcrypt,
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

  router.post(
    '/admin/scoring-rules',
    requireRole(['admin', 'master_admin']),
    (req, res) => {
      const { tournamentId, rules } = req.body || {}
      const id = Number(tournamentId)
      if (!id || Number.isNaN(id)) {
        return res.status(400).json({ message: 'Invalid tournament id' })
      }
      if (!rules || typeof rules !== 'object') {
        return res.status(400).json({ message: 'Rules required' })
      }
      const existing = scoringRules.find((r) => r.tournamentId === id)
      if (existing) {
        existing.rules = rules
        existing.updatedAt = new Date().toISOString()
        return res.json(existing)
      }
      const entry = {
        id: getNextScoringRuleId(),
        tournamentId: id,
        rules,
        createdAt: new Date().toISOString(),
      }
      scoringRules.push(entry)
      return res.status(201).json(entry)
    },
  )

  router.get('/admin/tournaments', requireRole(['admin', 'master_admin']), (req, res) => {
    return res.json(tournaments)
  })

  router.post(
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
        id: getNextTournamentId(),
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

  router.post(
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
        if (!name || !teamA || !teamB || !startTime) return
        const match = {
          id: getNextMatchId(),
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

  router.patch(
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

  router.post(
    '/admin/matches/:id/score-upload',
    requireRole(['admin', 'master_admin']),
    (req, res) => {
      const matchId = Number(req.params.id)
      if (Number.isNaN(matchId)) {
        return res.status(400).json({ message: 'Invalid match id' })
      }
      const { playerStats } = req.body || {}
      if (!Array.isArray(playerStats)) {
        return res.status(400).json({ message: 'playerStats required' })
      }
      const match = matches.find((m) => m.id === matchId)
      if (!match) {
        return res.status(404).json({ message: 'Match not found' })
      }
      const tournament = tournaments.find((t) => t.id === match.tournamentId)
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' })
      }
      const isOwner = tournament.createdBy === req.currentUser.id
      const isMaster = req.currentUser.role === 'master_admin'
      if (!isOwner && !isMaster) {
        return res.status(403).json({ message: 'Only owner or master can upload' })
      }
      matchScores.forEach((score) => {
        if (score.matchId === matchId) score.active = false
      })
      const payload = {
        id: getNextMatchScoreId(),
        matchId,
        tournamentId: match.tournamentId,
        playerStats,
        uploadedBy: req.currentUser.id,
        active: true,
        createdAt: new Date().toISOString(),
      }
      matchScores.push(payload)
      return res.status(201).json(payload)
    },
  )

  router.get(
    '/admin/matches/:id/score-history',
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
      const tournament = tournaments.find((t) => t.id === match.tournamentId)
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' })
      }
      const isOwner = tournament.createdBy === req.currentUser.id
      const isMaster = req.currentUser.role === 'master_admin'
      if (!isOwner && !isMaster) {
        return res.status(403).json({ message: 'Only owner or master can view' })
      }
      const history = matchScores.filter((s) => s.matchId === matchId)
      return res.json(history)
    },
  )

  router.post(
    '/admin/matches/:id/score-rollback',
    requireRole(['admin', 'master_admin']),
    (req, res) => {
      const matchId = Number(req.params.id)
      if (Number.isNaN(matchId)) {
        return res.status(400).json({ message: 'Invalid match id' })
      }
      const { scoreId } = req.body || {}
      if (!scoreId) {
        return res.status(400).json({ message: 'scoreId required' })
      }
      const match = matches.find((m) => m.id === matchId)
      if (!match) {
        return res.status(404).json({ message: 'Match not found' })
      }
      const tournament = tournaments.find((t) => t.id === match.tournamentId)
      if (!tournament) {
        return res.status(404).json({ message: 'Tournament not found' })
      }
      const isOwner = tournament.createdBy === req.currentUser.id
      const isMaster = req.currentUser.role === 'master_admin'
      if (!isOwner && !isMaster) {
        return res.status(403).json({ message: 'Only owner or master can rollback' })
      }
      const target = matchScores.find(
        (s) => s.matchId === matchId && s.id === Number(scoreId),
      )
      if (!target) {
        return res.status(404).json({ message: 'Score not found' })
      }
      matchScores.forEach((score) => {
        if (score.matchId === matchId) score.active = false
      })
      target.active = true
      return res.json(target)
    },
  )

  router.get('/tournaments', (req, res) => {
    return res.json(
      tournaments.map((t) => ({
        id: t.id,
        name: t.name,
        season: t.season,
        status: t.status,
      })),
    )
  })

  router.get('/tournaments/:id/matches', (req, res) => {
    const tournamentId = Number(req.params.id)
    if (Number.isNaN(tournamentId)) {
      return res.status(400).json({ message: 'Invalid tournament id' })
    }
    const list = matches.filter((m) => m.tournamentId === tournamentId)
    return res.json(list)
  })

  router.get('/tournaments/:id/leaderboard', (req, res) => {
    const tournamentId = Number(req.params.id)
    if (Number.isNaN(tournamentId)) {
      return res.status(400).json({ message: 'Invalid tournament id' })
    }
    const rules = getRulesForTournament(tournamentId)
    const tournamentMatches = matches.filter((m) => m.tournamentId === tournamentId)
    const totals = {}

    tournamentMatches.forEach((match) => {
      const score = matchScores.find((s) => s.matchId === match.id && s.active)
      if (!score) return
      const statsMap = {}
      score.playerStats.forEach((entry) => {
        if (entry && entry.playerId) {
          statsMap[entry.playerId] = entry
        }
      })
      teamSelections
        .filter((t) => t.matchId === match.id)
        .forEach((selection) => {
          const userId = selection.userId
          let points = 0
          selection.playingXi.forEach((playerId) => {
            const stats = statsMap[playerId] || {}
            points += calculatePoints(stats, rules)
          })
          totals[userId] = (totals[userId] || 0) + points
        })
    })

    const leaderboard = Object.entries(totals)
      .map(([userId, points]) => {
        const user = users.find((u) => u.id === Number(userId))
        return {
          userId: Number(userId),
          gameName: user?.gameName || 'Unknown',
          name: user?.name || 'Unknown',
          points,
        }
      })
      .sort((a, b) => b.points - a.points)

    return res.json(leaderboard)
  })

  router.post('/matches/:id/team', authenticate, (req, res) => {
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

  router.post(
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

  router.get('/users', requireRole(['admin', 'master_admin']), (req, res) => {
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
        userId: user.userId || user.gameName,
        gameName: user.gameName,
        phone: user.phone || '',
        location: user.location || '',
        email: user.email,
        status: user.status,
        role: user.role,
      })),
    )
  })

  router.patch('/users/:id', authenticate, (req, res) => {
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

    const {
      name,
      userId: requestedUserIdFromBody,
      gameName,
      location,
      phone,
      status,
      role,
      email,
      password,
    } = req.body || {}
    if (typeof name === 'string' && name.trim()) {
      targetUser.name = name.trim()
    }
    const requestedUserId =
      typeof requestedUserIdFromBody === 'string' && requestedUserIdFromBody.trim()
        ? requestedUserIdFromBody.trim()
        : typeof gameName === 'string' && gameName.trim()
          ? gameName.trim()
          : targetUser.userId || targetUser.gameName
    const nextGameName = requestedUserId
    const nextEmail =
      typeof email === 'string' && email.trim()
        ? email.trim().toLowerCase()
        : targetUser.email
    const conflict = findIdentityConflict({
      email: nextEmail,
      gameName: nextGameName,
      excludeUserId: targetUser.id,
    })
    if (conflict) {
      return res.status(409).json({ message: 'User already exists with same email or user id' })
    }
    targetUser.gameName = nextGameName
    targetUser.userId = nextGameName
    targetUser.email = nextEmail
    if (typeof phone === 'string') {
      targetUser.phone = phone.trim()
    }
    if (typeof location === 'string') {
      targetUser.location = location.trim()
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
      userId: targetUser.userId || targetUser.gameName,
      gameName: targetUser.gameName,
      phone: targetUser.phone || '',
      location: targetUser.location || '',
      email: targetUser.email,
      status: targetUser.status,
      role: targetUser.role,
    })
  })

  router.delete('/users/:id', requireRole(['master_admin']), (req, res) => {
    const userId = Number(req.params.id)
    if (Number.isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user id' })
    }
    const index = users.findIndex((user) => user.id === userId)
    if (index === -1) {
      return res.status(404).json({ message: 'User not found' })
    }
    if (users[index].role === 'master_admin') {
      return res.status(400).json({ message: 'Cannot delete master admin' })
    }
    const [removed] = users.splice(index, 1)
    return res.json({ id: removed.id, deleted: true })
  })
}

export { registerCoreRoutes }
