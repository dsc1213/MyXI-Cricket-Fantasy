const registerMockProviderRoutes = (router, ctx) => {
  const normalizeIdentity = (value) => (value || '').toString().trim().toLowerCase()
  const findIdentityConflict = ({ email, gameName, excludeUserId = null }) => {
    const normalizedEmail = normalizeIdentity(email)
    const normalizedGameName = normalizeIdentity(gameName)
    return users.find((user) => {
      if (excludeUserId != null && Number(user?.id) === Number(excludeUserId))
        return false
      const userEmail = normalizeIdentity(user?.email)
      const userGameName = normalizeIdentity(user?.gameName)
      return (
        (normalizedEmail && userEmail === normalizedEmail) ||
        (normalizedGameName && userGameName === normalizedGameName)
      )
    })
  }

  const {
    getMockPageLoadData,
    tournamentCatalog,
    enabledTournamentIds,
    users,
    appendAuditLog,
    persistState,
    mockContests,
    contestJoins,
    mockContestCatalog,
    buildMockContestId,
    buildMatches,
    normalizeMatchStatus,
    resolveMockSelection,
    getContestUserPool,
    normalizeUserKey,
    isFixedRosterContest,
    getFixedRosterNames,
    buildContestMatchPointsIndex,
    resolveMatchUserPickNames,
    nameHash,
    previewXI,
    buildContestLeaderboardRowsFromUserPool,
    buildContestUserMatchRows,
    prettyTournament,
    dashboardMockData,
    allKnownPlayers,
    playerStats,
    getPlayerPointsIndex,
    getTournamentPlayerStatsIndex,
    getMatchPlayerPointsByName,
    getMatchRosters,
    mockMatchLineups,
    lineupKey,
    validateLineupTeamPayload,
    selectionKey,
    mockTeamSelections,
    mockTournaments,
    customTournamentMatches,
    customMatchSquads,
    teamSquads,
    sampleUserPicks,
    idToPlayerName,
    allPlayerNames,
    namesToPlayerIds,
    getNextMatchScoreId,
    matchScores,
    resolveActorUser,
    canWriteScoresForContest,
    normalizePlayerStatRows,
  } = ctx

  const resolveAdminActor = (req) => {
    const fromBody = req.body?.actorUserId
    const fromHeader = req.headers?.['x-user-id']
    const actorId = (fromBody || fromHeader || '').toString().trim()
    if (!actorId) return null
    return resolveActorUser(actorId)
  }
  const resolveTeamActor = (req, fallbackUserId = '') => {
    const actorFromBody = req.body?.actorUserId
    const actorFromQuery = req.query?.actorUserId
    const actorFromHeader = req.headers?.['x-user-id']
    const actorId = (actorFromBody || actorFromQuery || actorFromHeader || fallbackUserId)
      .toString()
      .trim()
    if (!actorId) return null
    return resolveActorUser(actorId)
  }
  const canAccessAdminUsers = (actor) =>
    Boolean(actor && ['admin', 'master_admin'].includes(actor.role))
  const canAssignRole = ({ actor, nextRole, target }) => {
    if (!actor) return false
    if (actor.role === 'master_admin') return true
    if (actor.role !== 'admin') return false
    if (!target || target.role === 'master_admin') return false
    return ['user', 'contest_manager'].includes(nextRole)
  }
  const canManageTournaments = (actor) =>
    Boolean(actor && ['admin', 'master_admin'].includes(actor.role))
  const getTournamentCatalogRows = () => tournamentCatalog
  const normalizeTournamentId = (value = '') =>
    value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const normalizeTeamCode = (value = '') =>
    value
      .toString()
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
  const getTeamSquadByCode = (teamCode = '') =>
    teamSquads.find((item) => item.teamCode === normalizeTeamCode(teamCode)) || null
  const getTournamentTeamCodes = (tournamentId = '') => {
    const rows = buildMatches(200, tournamentId)
    const codes = new Set()
    rows.forEach((match) => {
      const home = normalizeTeamCode(match?.home || '')
      const away = normalizeTeamCode(match?.away || '')
      if (home) codes.add(home)
      if (away) codes.add(away)
    })
    return codes
  }
  const getTournamentCatalogEntry = (tournamentId = '') =>
    getTournamentCatalogRows().find((item) => item.id === tournamentId) || null
  const getTournamentSquadTeamCodes = (tournamentId = '') => {
    const tournament = getTournamentCatalogEntry(tournamentId)
    const tournamentName = (tournament?.name || '').toString().trim().toLowerCase()
    if (!tournamentName) return new Set()
    return new Set(
      teamSquads
        .filter((item) => (item?.tournament || '').toString().trim().toLowerCase() === tournamentName)
        .map((item) => normalizeTeamCode(item?.teamCode || ''))
        .filter(Boolean),
    )
  }
  const getTournamentPlayers = (tournamentId = '') => {
    if (!tournamentId) return [...allKnownPlayers]
    const squadTeamCodes = getTournamentSquadTeamCodes(tournamentId)
    const teamCodes = squadTeamCodes.size ? squadTeamCodes : getTournamentTeamCodes(tournamentId)
    const filtered = allKnownPlayers.filter((player) =>
      teamCodes.has(normalizeTeamCode(player?.team || '')),
    )
    return filtered.length ? filtered : [...allKnownPlayers]
  }
  const normalizeSquadEntries = (raw = []) => {
    const seen = new Set()
    const entries = []
    ;(Array.isArray(raw) ? raw : []).forEach((item) => {
      let name = ''
      let country = ''
      let role = ''
      let battingStyle = ''
      let bowlingStyle = ''
      let active = true
      if (typeof item === 'string') {
        name = item.trim()
      } else if (item && typeof item === 'object') {
        name = (item.name || item.playerName || '').toString().trim()
        country = (item.country || item.playerCountry || '').toString().trim()
        role = (item.role || item.playerRole || '').toString().trim().toUpperCase()
        battingStyle = (item.battingStyle || '').toString().trim()
        bowlingStyle = (item.bowlingStyle || '').toString().trim()
        active = item.active !== false
      }
      if (!name) return
      const key = name.toLowerCase()
      if (seen.has(key)) return
      seen.add(key)
      entries.push({ name, country, role, battingStyle, bowlingStyle, active })
    })
    return entries
  }
  const computeContestLastScoreMeta = (contest) => {
    const contestMatchIds = new Set(
      getContestMatches(contest).map((match) => match.id.toString()),
    )
    const latest = [...matchScores]
      .filter(
        (row) =>
          row?.active !== false &&
          (row?.tournamentId || '').toString() ===
            (contest?.tournamentId || '').toString() &&
          contestMatchIds.has((row?.matchId || '').toString()),
      )
      .sort(
        (a, b) =>
          new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime(),
      )[0]
    return {
      lastScoreUpdatedAt: latest?.createdAt || null,
      lastScoreUpdatedBy: latest?.uploadedBy || null,
    }
  }
  const normalizeActorId = (value = '') => value.toString().trim().toLowerCase()
  const getJoinedSetForUser = (userId = '') => {
    const normalized = normalizeActorId(userId)
    if (!normalized) return new Set()
    const saved = Array.isArray(contestJoins[normalized]) ? contestJoins[normalized] : []
    return new Set(saved)
  }
  const saveJoinedSetForUser = (userId = '', joinedSet = new Set()) => {
    const normalized = normalizeActorId(userId)
    if (!normalized) return
    contestJoins[normalized] = Array.from(joinedSet)
  }
  const getContestJoinedCount = (contestId = '') => {
    const target = (contestId || '').toString()
    if (!target) return 0
    const fixedContest = mockContests.find((contest) => contest.id === target)
    if (isFixedRosterContest(fixedContest)) {
      return Array.isArray(fixedContest?.fixedParticipants)
        ? fixedContest.fixedParticipants.length
        : 0
    }
    return Object.values(contestJoins).reduce((count, joinedIds) => {
      const list = Array.isArray(joinedIds) ? joinedIds.map((id) => id.toString()) : []
      return count + (list.includes(target) ? 1 : 0)
    }, 0)
  }
  const getContestMatches = (contest) => {
    const allMatches = buildMatches(100, contest?.tournamentId || 't20wc-2026')
    const scopedIds = Array.isArray(contest?.matchIds)
      ? contest.matchIds.map((id) => id.toString())
      : []
    if (!scopedIds.length) return allMatches
    const scopedIdSet = new Set(scopedIds)
    const scopedMatches = allMatches.filter((match) => scopedIdSet.has(match.id))
    return scopedMatches.length ? scopedMatches : allMatches
  }
  const isContestJoinOpen = (contest) => {
    if (isFixedRosterContest(contest)) return false
    const contestMatches = getContestMatches(contest)
      .slice()
      .sort((a, b) => Number(a.matchNo || 0) - Number(b.matchNo || 0))
    const firstMatch = contestMatches[0] || null
    if (!firstMatch) return false
    if (normalizeMatchStatus(firstMatch.status) !== 'notstarted') return false
    const firstStartAt =
      (firstMatch.startAt || '').toString().trim() ||
      `${(firstMatch.date || '2099-01-01').toString()}T00:00:00.000Z`
    const firstStartMs = new Date(firstStartAt).getTime()
    if (!Number.isFinite(firstStartMs)) {
      return normalizeMatchStatus(firstMatch.status) === 'notstarted'
    }
    return Date.now() < firstStartMs
  }

  router.get('/page-load-data', getMockPageLoadData)
  router.get('/bootstrap', getMockPageLoadData)

  router.get('/tournaments', (req, res) => {
    const list = getTournamentCatalogRows().filter((item) =>
      enabledTournamentIds.has(item.id),
    )
    return res.json(list)
  })

  router.get('/admin/users', (req, res) => {
    const rows = users.map((user) => ({
      id: user.id,
      name: user.name,
      userId: user.userId || user.gameName,
      gameName: user.gameName,
      phone: user.phone || '',
      location: user.location || '',
      email: user.email,
      role: user.role,
      contestManagerContestId: user.contestManagerContestId || null,
      status: user.status,
      joinedAt: user.createdAt,
    }))
    return res.json(rows)
  })

  router.patch('/admin/users/:id', (req, res) => {
    const actor = resolveAdminActor(req)
    if (!canAccessAdminUsers(actor)) {
      return res.status(403).json({ message: 'Only admin/master can manage users' })
    }
    const id = Number(req.params.id)
    const target = users.find((item) => item.id === id)
    if (!target) return res.status(404).json({ message: 'User not found' })
    if (target.role === 'master_admin' && actor.role !== 'master_admin') {
      return res
        .status(403)
        .json({ message: 'Only master can modify master admin users' })
    }
    const {
      name,
      userId,
      gameName,
      location,
      phone,
      email,
      role,
      status,
      contestManagerContestId,
    } = req.body || {}
    const requestedUserId =
      typeof userId === 'string' && userId.trim()
        ? userId.trim()
        : typeof gameName === 'string' && gameName.trim()
          ? gameName.trim()
          : target.userId || target.gameName
    const nextGameName = requestedUserId
    const nextEmail =
      typeof email === 'string' && email.trim()
        ? email.trim().toLowerCase()
        : target.email
    const conflict = findIdentityConflict({
      email: nextEmail,
      gameName: nextGameName,
      excludeUserId: target.id,
    })
    if (conflict) {
      return res
        .status(409)
        .json({ message: 'User already exists with same email or user id' })
    }
    if (typeof name === 'string' && name.trim()) target.name = name.trim()
    target.gameName = nextGameName
    target.userId = nextGameName
    if (typeof phone === 'string') target.phone = phone.trim()
    if (typeof location === 'string') target.location = location.trim()
    target.email = nextEmail
    if (
      typeof role === 'string' &&
      ['user', 'admin', 'master_admin', 'contest_manager'].includes(role)
    ) {
      if (!canAssignRole({ actor, nextRole: role, target })) {
        return res.status(403).json({
          message: 'Only master can assign admin/master roles',
        })
      }
      if (target.role !== 'master_admin' || role === 'master_admin') {
        target.role = role
      }
    }
    if (Object.hasOwn(req.body || {}, 'contestManagerContestId')) {
      const nextContestId =
        typeof contestManagerContestId === 'string' && contestManagerContestId.trim()
          ? contestManagerContestId.trim()
          : null
      const contestExists = nextContestId
        ? mockContests.some((item) => item.id === nextContestId)
        : true
      if (!contestExists) {
        return res
          .status(400)
          .json({ message: 'Invalid contest for score manager scope' })
      }
      target.contestManagerContestId = nextContestId
    }
    if (target.role !== 'contest_manager') {
      target.contestManagerContestId = null
    } else if (!target.contestManagerContestId) {
      target.contestManagerContestId = mockContests[0]?.id || null
    }
    if (
      typeof status === 'string' &&
      ['active', 'pending', 'rejected'].includes(status)
    ) {
      target.status = status
    }
    appendAuditLog({
      actor: actor?.gameName || actor?.name || 'Admin',
      action: 'Updated user profile',
      target: target.gameName || target.email || String(target.id),
      detail: `Role: ${target.role}, Scope: ${target.contestManagerContestId || 'n/a'}, Status: ${target.status}`,
      tournamentId: 'global',
      module: 'users',
    })
    persistState()
    return res.json({
      id: target.id,
      name: target.name,
      userId: target.userId || target.gameName,
      gameName: target.gameName,
      phone: target.phone || '',
      location: target.location || '',
      email: target.email,
      role: target.role,
      contestManagerContestId: target.contestManagerContestId || null,
      status: target.status,
      joinedAt: target.createdAt,
    })
  })

  router.delete('/admin/users/:id', (req, res) => {
    const actor = resolveAdminActor(req)
    if (!actor || actor.role !== 'master_admin') {
      return res.status(403).json({ message: 'Only master can delete users' })
    }
    const id = Number(req.params.id)
    const index = users.findIndex((item) => item.id === id)
    if (index === -1) return res.status(404).json({ message: 'User not found' })
    if (users[index].role === 'master_admin') {
      return res.status(400).json({ message: 'Cannot delete master admin' })
    }
    const [removed] = users.splice(index, 1)
    const removedKeys = new Set(
      [removed?.id, removed?.userId, removed?.gameName, removed?.email]
        .filter(Boolean)
        .map((value) => normalizeActorId(value)),
    )
    removedKeys.forEach((removedKey) => {
      if (removedKey && Object.hasOwn(contestJoins, removedKey)) {
        delete contestJoins[removedKey]
      }
    })
    for (const [key, selection] of mockTeamSelections.entries()) {
      const selectionKeys = new Set(
        [selection?.userId]
          .filter(Boolean)
          .map((value) => normalizeActorId(value)),
      )
      const shouldDelete = [...selectionKeys].some((value) => removedKeys.has(value))
      if (shouldDelete) {
        mockTeamSelections.delete(key)
      }
    }
    removedKeys.forEach((removedKey) => {
      if (removedKey && Object.hasOwn(sampleUserPicks, removedKey)) {
        delete sampleUserPicks[removedKey]
      }
    })
    appendAuditLog({
      actor: actor.gameName || actor.name || 'Admin',
      action: 'Deleted user',
      target: removed.gameName || removed.email || String(removed.id),
      detail: 'User removed from system',
      tournamentId: 'global',
      module: 'users',
    })
    persistState()
    return res.json({ ok: true, removedId: removed.id })
  })

  router.get('/admin/tournaments/catalog', (req, res) => {
    const rows = getTournamentCatalogRows().map((item) => ({
      ...item,
      enabled: enabledTournamentIds.has(item.id),
      hasActiveContests: mockContests.some(
        (contest) =>
          contest.tournamentId === item.id &&
          contest.status?.toLowerCase() !== 'completed',
      ),
      contestsCount: mockContests.filter((contest) => contest.tournamentId === item.id)
        .length,
      matchesCount: buildMatches(200, item.id).length,
    }))
    return res.json(rows)
  })

  router.get('/admin/team-squads', (req, res) => {
    const teamCode = normalizeTeamCode(req.query.teamCode || '')
    const rows = teamCode
      ? teamSquads.filter((item) => item.teamCode === teamCode)
      : [...teamSquads]
    const payload = rows
      .map((item) => ({
        teamCode: item.teamCode,
        teamName: item.teamName || item.teamCode,
        playersCount: normalizeSquadEntries(item.squad || []).length,
        activePlayersCount: normalizeSquadEntries(item.squad || []).filter(
          (p) => p.active,
        ).length,
        squad: normalizeSquadEntries(item.squad || []),
        tournamentType: item.tournamentType || 'international',
        country: item.country || '',
        league: item.league || '',
        tournament: item.tournament || '',
        source: item.source || 'manual',
        lastUpdatedAt: item.lastUpdatedAt || null,
      }))
      .sort((a, b) => a.teamCode.localeCompare(b.teamCode))
    return res.json(payload)
  })

  router.post('/admin/team-squads', (req, res) => {
    const actor = resolveAdminActor(req)
    if (!canManageTournaments(actor)) {
      return res.status(403).json({ message: 'Only admin/master can manage squads' })
    }
    const teamCode = normalizeTeamCode(req.body?.teamCode || '')
    const teamName = (req.body?.teamName || teamCode || '').toString().trim()
    const source = (req.body?.source || 'manual').toString().trim().toLowerCase()
    const rawSquad = Array.isArray(req.body?.squad) ? req.body.squad : []
    const normalizedSquad = normalizeSquadEntries(rawSquad)
    const tournamentType = (req.body?.tournamentType || 'international')
      .toString()
      .trim()
      .toLowerCase()
    const country = (req.body?.country || '').toString().trim()
    const league = (req.body?.league || '').toString().trim()
    const tournament = (req.body?.tournament || '').toString().trim()
    if (!teamCode) {
      return res.status(400).json({ message: 'teamCode is required' })
    }
    if (normalizedSquad.length < 1) {
      return res.status(400).json({ message: 'Squad must include at least 1 player' })
    }
    const now = new Date().toISOString()
    const existingIndex = teamSquads.findIndex((item) => item.teamCode === teamCode)
    const nextRow = {
      teamCode,
      teamName: teamName || teamCode,
      squad: normalizedSquad,
      tournamentType,
      country,
      league,
      tournament,
      source: source || 'manual',
      lastUpdatedAt: now,
    }
    if (existingIndex === -1) {
      teamSquads.push(nextRow)
    } else {
      teamSquads.splice(existingIndex, 1, nextRow)
    }
    appendAuditLog({
      actor: actor?.gameName || actor?.name || 'Admin',
      action: existingIndex === -1 ? 'Added squad' : 'Updated squad',
      target: teamCode,
      detail: `${normalizedSquad.length} players`,
      tournamentId: 'global',
      module: 'squads',
    })
    persistState()
    return res.status(existingIndex === -1 ? 201 : 200).json({
      ok: true,
      squad: {
        ...nextRow,
        playersCount: normalizedSquad.length,
        activePlayersCount: normalizedSquad.filter((p) => p.active).length,
      },
    })
  })

  router.delete('/admin/team-squads/:teamCode', (req, res) => {
    const actor = resolveAdminActor(req)
    if (!canManageTournaments(actor)) {
      return res.status(403).json({ message: 'Only admin/master can manage squads' })
    }
    const teamCode = normalizeTeamCode(req.params.teamCode || '')
    const index = teamSquads.findIndex((item) => item.teamCode === teamCode)
    if (index === -1) {
      return res.status(404).json({ message: 'Squad not found' })
    }
    const [removed] = teamSquads.splice(index, 1)
    appendAuditLog({
      actor: actor?.gameName || actor?.name || 'Admin',
      action: 'Deleted squad',
      target: removed.teamCode,
      detail: `${Array.isArray(removed.squad) ? removed.squad.length : 0} players removed`,
      tournamentId: 'global',
      module: 'squads',
    })
    persistState()
    return res.json({ ok: true, removedId: removed.teamCode })
  })

  router.post('/admin/tournaments', (req, res) => {
    const actor = resolveAdminActor(req)
    if (!canManageTournaments(actor)) {
      return res.status(403).json({ message: 'Only admin/master can create tournaments' })
    }
    const {
      name,
      season = '2026',
      tournamentId,
      createdBy,
      source = 'manual',
      matches = [],
      jsonPayload = null,
    } = req.body || {}
    const payload =
      jsonPayload && typeof jsonPayload === 'object' ? jsonPayload : req.body || {}
    const payloadName = (payload.name || name || '').toString().trim()
    const payloadSeason = (payload.season || season || '2026').toString().trim()
    const rawMatches = Array.isArray(payload.matches)
      ? payload.matches
      : Array.isArray(matches)
        ? matches
        : []
    if (!payloadName) {
      return res.status(400).json({ message: 'Tournament name is required' })
    }
    if (!rawMatches.length) {
      return res.status(400).json({ message: 'At least one match is required' })
    }
    const idBase = normalizeTournamentId(
      tournamentId || `${payloadName}-${payloadSeason}`,
    )
    const nextId = idBase || `tournament-${Date.now()}`
    if (getTournamentCatalogRows().some((item) => item.id === nextId)) {
      return res.status(409).json({ message: 'Tournament already exists' })
    }

    const normalizedMatches = rawMatches
      .map((row, index) => {
        const matchNo = Number(row?.matchNo || index + 1)
        const home = (row?.home || row?.homeTeam || '').toString().trim().toUpperCase()
        const away = (row?.away || row?.awayTeam || '').toString().trim().toUpperCase()
        if (!home || !away) return null
        const date = (row?.date || '').toString().trim()
        const startAtRaw = (row?.startAt || row?.startDateTime || '').toString().trim()
        const startAt = startAtRaw || `${date || '2099-01-01'}T00:00:00.000Z`
        const status = normalizeMatchStatus(row?.status || 'notstarted')
        const id = (row?.id || `m${matchNo}`).toString()
        const fallbackSquadA = getTeamSquadByCode(home)?.squad || []
        const fallbackSquadB = getTeamSquadByCode(away)?.squad || []
        return {
          id,
          matchNo,
          home,
          away,
          name: row?.name || `Match ${matchNo}: ${home} vs ${away}`,
          date: date || startAt.slice(0, 10),
          startAt,
          status,
          venue: (row?.venue || '').toString().trim(),
          stage: (row?.stage || 'league').toString().trim() || 'league',
          stageLabel: (row?.stageLabel || 'League').toString().trim() || 'League',
          squadA: Array.isArray(row?.squadA)
            ? row.squadA.map((item) => item.toString())
            : [...fallbackSquadA],
          squadB: Array.isArray(row?.squadB)
            ? row.squadB.map((item) => item.toString())
            : [...fallbackSquadB],
          playingXiA: Array.isArray(row?.playingXiA)
            ? row.playingXiA.map((item) => item.toString())
            : [],
          playingXiB: Array.isArray(row?.playingXiB)
            ? row.playingXiB.map((item) => item.toString())
            : [],
          locked: status === 'notstarted',
          hasTeam: false,
        }
      })
      .filter(Boolean)
      .sort((a, b) => Number(a.matchNo || 0) - Number(b.matchNo || 0))
    if (!normalizedMatches.length) {
      return res.status(400).json({ message: 'Matches must include valid teams' })
    }

    const tournamentRow = {
      id: nextId,
      name: payloadName,
      season: payloadSeason,
      source: source.toString(),
      createdBy: (createdBy || actor?.gameName || actor?.email || 'admin').toString(),
      lastUpdatedAt: new Date().toISOString(),
    }
    mockTournaments.push(tournamentRow)
    getTournamentCatalogRows().push({
      ...tournamentRow,
      sourceKey: nextId,
    })
    enabledTournamentIds.add(nextId)
    customTournamentMatches[nextId] = normalizedMatches
    customMatchSquads[nextId] = normalizedMatches.map((row) => ({
      matchId: row.id,
      home: row.home,
      away: row.away,
      squadA: row.squadA,
      squadB: row.squadB,
      playingXiA: row.playingXiA,
      playingXiB: row.playingXiB,
    }))
    prettyTournament[nextId] = payloadName
    dashboardMockData.tournaments = getTournamentCatalogRows().filter((item) =>
      enabledTournamentIds.has(item.id),
    )
    appendAuditLog({
      actor: actor?.gameName || actor?.name || 'Admin',
      action: 'Created tournament',
      target: payloadName,
      detail: `${normalizedMatches.length} matches imported (${source})`,
      tournamentId: nextId,
      module: 'tournaments',
    })
    persistState()
    return res.status(201).json({
      ok: true,
      tournament: tournamentRow,
      matchesImported: normalizedMatches.length,
    })
  })

  router.delete('/admin/tournaments/:id', (req, res) => {
    const actor = resolveAdminActor(req)
    if (!canManageTournaments(actor)) {
      return res.status(403).json({ message: 'Only admin/master can delete tournaments' })
    }
    const tournamentId = (req.params.id || '').toString()
    const catalogRows = getTournamentCatalogRows()
    const catalogIndex = catalogRows.findIndex((item) => item.id === tournamentId)
    if (catalogIndex === -1) {
      return res.status(404).json({ message: 'Tournament not found' })
    }
    const contestsToRemove = mockContests
      .filter((contest) => contest.tournamentId === tournamentId)
      .map((contest) => contest.id)
    for (let i = mockContests.length - 1; i >= 0; i -= 1) {
      if (mockContests[i].tournamentId === tournamentId) mockContests.splice(i, 1)
    }
    contestsToRemove.forEach((id) => mockContestCatalog.delete(id))
    Object.keys(contestJoins).forEach((userKey) => {
      const joined = Array.isArray(contestJoins[userKey]) ? contestJoins[userKey] : []
      contestJoins[userKey] = joined.filter(
        (contestId) => !contestsToRemove.includes(contestId),
      )
    })
    enabledTournamentIds.delete(tournamentId)
    catalogRows.splice(catalogIndex, 1)
    for (let i = mockTournaments.length - 1; i >= 0; i -= 1) {
      if (mockTournaments[i].id === tournamentId) mockTournaments.splice(i, 1)
    }
    delete customTournamentMatches[tournamentId]
    delete customMatchSquads[tournamentId]
    delete prettyTournament[tournamentId]
    dashboardMockData.tournaments = getTournamentCatalogRows().filter((item) =>
      enabledTournamentIds.has(item.id),
    )
    appendAuditLog({
      actor: actor?.gameName || actor?.name || 'Admin',
      action: 'Deleted tournament',
      target: tournamentId,
      detail: `Removed ${contestsToRemove.length} contests`,
      tournamentId,
      module: 'tournaments',
    })
    persistState()
    return res.json({
      ok: true,
      removedTournamentId: tournamentId,
      removedContests: contestsToRemove.length,
    })
  })

  router.post('/admin/tournaments/enable', (req, res) => {
    const actor = resolveAdminActor(req)
    if (!canManageTournaments(actor)) {
      return res.status(403).json({ message: 'Only admin/master can manage tournaments' })
    }
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    ids.forEach((id) => {
      if (getTournamentCatalogRows().find((item) => item.id === id)) {
        enabledTournamentIds.add(id)
      }
    })
    const enabled = getTournamentCatalogRows().filter((item) =>
      enabledTournamentIds.has(item.id),
    )
    dashboardMockData.tournaments = enabled
    if (ids.length) {
      appendAuditLog({
        actor: actor?.gameName || actor?.name || 'Admin',
        action: 'Enabled tournaments',
        target: ids.join(', '),
        detail: `${ids.length} tournament(s) added to fantasy`,
        tournamentId: 'global',
        module: 'tournaments',
      })
    }
    persistState()
    return res.json({ ok: true, tournaments: enabled })
  })

  router.post('/admin/tournaments/disable', (req, res) => {
    const actor = resolveAdminActor(req)
    if (!canManageTournaments(actor)) {
      return res.status(403).json({ message: 'Only admin/master can manage tournaments' })
    }
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    ids.forEach((id) => {
      if (getTournamentCatalogRows().find((item) => item.id === id)) {
        enabledTournamentIds.delete(id)
      }
    })
    const enabled = getTournamentCatalogRows().filter((item) =>
      enabledTournamentIds.has(item.id),
    )
    dashboardMockData.tournaments = enabled
    if (ids.length) {
      appendAuditLog({
        actor: actor?.gameName || actor?.name || 'Admin',
        action: 'Disabled tournaments',
        target: ids.join(', '),
        detail: `${ids.length} tournament(s) removed from fantasy`,
        tournamentId: 'global',
        module: 'tournaments',
      })
    }
    persistState()
    return res.json({ ok: true, tournaments: enabled })
  })

  router.post('/admin/contests', (req, res) => {
    const {
      name,
      tournamentId,
      game = 'Fantasy',
      teams = 0,
      status = 'Open',
      joined = false,
      createdBy = 'admin',
      matchIds = [],
    } = req.body || {}
    if (!name || !tournamentId) {
      return res.status(400).json({ message: 'name and tournamentId are required' })
    }
    const existsTournament = getTournamentCatalogRows().find(
      (item) => item.id === tournamentId,
    )
    if (!existsTournament || !enabledTournamentIds.has(tournamentId)) {
      return res.status(400).json({ message: 'Tournament is not enabled' })
    }
    const allowedMatchIds = new Set(
      buildMatches(100, tournamentId.toString())
        .filter((match) => normalizeMatchStatus(match.status) === 'notstarted')
        .map((match) => match.id),
    )
    const normalizedMatchIds = Array.from(
      new Set(
        (Array.isArray(matchIds) ? matchIds : [])
          .map((id) => id?.toString?.() || '')
          .filter((id) => allowedMatchIds.has(id)),
      ),
    ).sort((a, b) => {
      const aNo = Number(a.replace(/[^\d]/g, '') || 0)
      const bNo = Number(b.replace(/[^\d]/g, '') || 0)
      return aNo - bNo
    })
    if (!normalizedMatchIds.length) {
      return res.status(400).json({
        message: 'Select at least one not-started match for the contest',
      })
    }

    const contest = {
      id: buildMockContestId(name),
      name: name.toString().trim(),
      tournamentId: tournamentId.toString(),
      game: game.toString(),
      teams: Number(teams || 0),
      status: status.toString(),
      joined: Boolean(joined),
      points: 0,
      rank: '-',
      createdBy: createdBy.toString(),
      isCustom: true,
      matchIds: normalizedMatchIds,
      lastScoreUpdatedAt: null,
      lastScoreUpdatedBy: null,
    }
    mockContests.unshift(contest)
    mockContestCatalog.set(contest.id, { ...contest })
    appendAuditLog({
      actor: createdBy.toString(),
      action: 'Created contest',
      target: contest.name,
      detail: `${contest.game} contest (${contest.teams} max players)`,
      tournamentId: contest.tournamentId,
      module: 'contests',
    })
    persistState()
    return res.status(201).json(contest)
  })

  router.delete('/admin/contests/:contestId', (req, res) => {
    const actor = resolveAdminActor(req)
    if (!canAccessAdminUsers(actor)) {
      return res.status(403).json({ message: 'Only admin/master can delete contests' })
    }
    const id = (req.params.contestId || '').toString()
    const index = mockContests.findIndex((item) => item.id === id)
    if (index === -1) return res.status(404).json({ message: 'Contest not found' })
    const target = mockContests[index]
    const actorKey = normalizeActorId(
      actor?.gameName || actor?.email || actor?.name || '',
    )
    const createdByKey = normalizeActorId(target?.createdBy || '')
    const isMaster = actor?.role === 'master_admin'
    const isOwner = Boolean(actorKey) && actorKey === createdByKey
    if (!isMaster && !isOwner) {
      return res.status(403).json({
        message: 'Only contest owner admin or master can delete this contest',
      })
    }
    const [removed] = mockContests.splice(index, 1)
    Object.keys(contestJoins).forEach((key) => {
      const list = Array.isArray(contestJoins[key]) ? contestJoins[key] : []
      contestJoins[key] = list.filter((contestId) => contestId !== removed.id)
    })
    appendAuditLog({
      actor: actor?.gameName || actor?.name || 'Admin',
      action: 'Removed contest',
      target: removed.name,
      detail: 'Contest removed from fantasy listing',
      tournamentId: removed.tournamentId || 'global',
      module: 'contests',
    })
    persistState()
    return res.json({ ok: true, removedId: removed.id })
  })

  router.get('/admin/contests/catalog', (req, res) => {
    const tournamentId = (req.query.tournamentId || '').toString()
    const enabledContestIds = new Set(mockContests.map((item) => item.id))
    const rows = Array.from(mockContestCatalog.values())
      .filter((contest) => !tournamentId || contest.tournamentId === tournamentId)
      .map((contest) => ({
        ...contest,
        enabled: enabledContestIds.has(contest.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return res.json(rows)
  })

  router.get('/admin/contest-match-options', (req, res) => {
    const tournamentId = (req.query.tournamentId || '').toString()
    let matches = []
    if (
      Array.isArray(customTournamentMatches[tournamentId]) &&
      customTournamentMatches[tournamentId].length > 0
    ) {
      matches = customTournamentMatches[tournamentId]
    } else {
      matches = buildMatches(100, tournamentId || 't20wc-2026')
    }
    const rows = matches.map((match) => ({
      id: match.id,
      matchNo: match.matchNo,
      name: `${match.home} vs ${match.away}`,
      date: match.date,
      startAt: match.startAt || `${match.date}T00:00:00.000Z`,
      status: match.status,
      tournamentId: tournamentId || 't20wc-2026',
      selectable: (() => {
        return normalizeMatchStatus(match.status) === 'notstarted'
      })(),
    }))
    return res.json(rows)
  })

  router.post('/admin/contests/sync', (req, res) => {
    const tournamentId = (req.body?.tournamentId || '').toString()
    const enabledIds = Array.isArray(req.body?.enabledIds)
      ? req.body.enabledIds.map((id) => id.toString())
      : []
    if (!tournamentId) {
      return res.status(400).json({ message: 'tournamentId is required' })
    }
    const validIds = new Set(
      Array.from(mockContestCatalog.values())
        .filter((contest) => contest.tournamentId === tournamentId)
        .map((contest) => contest.id),
    )
    const nextEnabledIds = new Set(enabledIds.filter((id) => validIds.has(id)))
    const currentEnabledIds = new Set(
      mockContests
        .filter((contest) => contest.tournamentId === tournamentId)
        .map((contest) => contest.id),
    )

    const toRemove = Array.from(currentEnabledIds).filter((id) => !nextEnabledIds.has(id))
    const toAdd = Array.from(nextEnabledIds).filter((id) => !currentEnabledIds.has(id))

    if (toRemove.length) {
      toRemove.forEach((id) => {
        const index = mockContests.findIndex((contest) => contest.id === id)
        if (index !== -1) mockContests.splice(index, 1)
      })
    }
    if (toAdd.length) {
      const adds = toAdd
        .map((id) => mockContestCatalog.get(id))
        .filter(Boolean)
        .map((contest) => ({ ...contest }))
      mockContests.unshift(...adds)
    }
    if (toAdd.length || toRemove.length) {
      appendAuditLog({
        actor: 'Admin',
        action: 'Synced contests',
        target: tournamentId,
        detail: `Added: ${toAdd.length}, Removed: ${toRemove.length}`,
        tournamentId,
        module: 'contests',
      })
    }
    persistState()
    return res.json({
      ok: true,
      tournamentId,
      added: toAdd,
      removed: toRemove,
      enabledIds: Array.from(nextEnabledIds),
    })
  })

  router.get('/contests', (req, res) => {
    const game = (req.query.game || '').toString()
    const tournamentId = (req.query.tournamentId || '').toString()
    const joined = (req.query.joined || '').toString()
    const userId = (req.query.userId || '').toString()
    const userJoinedSet = getJoinedSetForUser(userId)

    const list = mockContests.filter((contest) => {
      const gameOk = !game || contest.game === game
      const tournamentOk = !tournamentId || contest.tournamentId === tournamentId
      const isJoined = userId ? userJoinedSet.has(contest.id) : Boolean(contest.joined)
      const joinedOk =
        !joined || (joined === 'true' && isJoined) || (joined === 'false' && !isJoined)
      return gameOk && tournamentOk && joinedOk
    })
    const rows = list.map((contest) => {
      const joinedCount = getContestJoinedCount(contest.id)
      const maxPlayers = Number(contest.teams || 0)
      const hasCapacity = maxPlayers <= 0 || joinedCount < maxPlayers
      const joinOpen = isContestJoinOpen(contest)
      const scoreMeta = computeContestLastScoreMeta(contest)
      return {
        ...contest,
        joined: userId ? userJoinedSet.has(contest.id) : Boolean(contest.joined),
        joinedCount,
        maxPlayers,
        hasCapacity,
        joinOpen: !isFixedRosterContest(contest) && joinOpen && hasCapacity,
        ...scoreMeta,
      }
    })
    return res.json(rows)
  })

  router.post('/contests/:contestId/join', (req, res) => {
    const contestId = (req.params.contestId || '').toString()
    const userId = (req.body?.userId || '').toString()
    if (!contestId || !userId) {
      return res.status(400).json({ message: 'contestId and userId are required' })
    }
    const contest = mockContests.find((item) => item.id === contestId)
    if (!contest) return res.status(404).json({ message: 'Contest not found' })
    if (isFixedRosterContest(contest)) {
      return res.status(403).json({ message: 'This contest has fixed participant rosters' })
    }
    const joinedSet = getJoinedSetForUser(userId)
    if (joinedSet.has(contestId)) {
      return res.json({ ok: true, contestId, userId, joined: true })
    }
    const maxPlayers = Number(contest.teams || 0)
    const joinedCount = getContestJoinedCount(contest.id)
    if (maxPlayers > 0 && joinedCount >= maxPlayers) {
      return res.status(403).json({ message: 'Contest is full' })
    }
    if (!isContestJoinOpen(contest)) {
      return res.status(403).json({
        message: 'Contest join is closed because tournament/contest has already started',
      })
    }
    joinedSet.add(contestId)
    saveJoinedSetForUser(userId, joinedSet)
    persistState()
    return res.json({ ok: true, contestId, userId, joined: true })
  })

  router.post('/contests/:contestId/leave', (req, res) => {
    const contestId = (req.params.contestId || '').toString()
    const userId = (req.body?.userId || '').toString()
    if (!contestId || !userId) {
      return res.status(400).json({ message: 'contestId and userId are required' })
    }
    const contest = mockContests.find((item) => item.id === contestId)
    if (!contest) return res.status(404).json({ message: 'Contest not found' })
    const joinedSet = getJoinedSetForUser(userId)
    joinedSet.delete(contestId)
    saveJoinedSetForUser(userId, joinedSet)
    persistState()
    return res.json({ ok: true, contestId, userId, joined: false })
  })

  router.get('/contests/:contestId', (req, res) => {
    const contest = mockContests.find((item) => item.id === req.params.contestId)
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' })
    }
    const scoreMeta = computeContestLastScoreMeta(contest)
    return res.json({
      ...contest,
      ...scoreMeta,
    })
  })

  router.get('/contests/:contestId/matches', (req, res) => {
    const contest = mockContests.find((item) => item.id === req.params.contestId)
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' })
    }
    const status = (req.query.status || 'all').toString()
    const team = (req.query.team || 'all').toString()
    const userId = (req.query.userId || 'kiran11').toString()
    const viewerJoinedSet = getJoinedSetForUser(userId)
    const viewerJoined = viewerJoinedSet.has(contest.id)
    const matches = getContestMatches(contest).filter((match) => {
      const matchStatus = normalizeMatchStatus(match.status)
      const statusOk =
        status === 'all' ||
        (status === 'completed' && matchStatus === 'completed') ||
        (status === 'inprogress' && matchStatus === 'inprogress') ||
        (status === 'notstarted' && matchStatus === 'notstarted')
      const teamOk = team === 'all' || match.home === team || match.away === team
      return statusOk && teamOk
    })
    const joinedCount = getContestJoinedCount(contest.id)
    const rows = matches.map((match) => {
      const usersPool = getContestUserPool({
        contest,
        matchId: match.id,
        viewerUserId: userId,
      })
      const submittedCount = usersPool.reduce((count, seededUser) => {
        const pickNames = resolveMatchUserPickNames({
          contestId: contest.id,
          matchId: match.id,
          userId: seededUser.userId,
        })
        return count + (pickNames.length > 0 ? 1 : 0)
      }, 0)
      const viewerPickNames = resolveMatchUserPickNames({
        contestId: contest.id,
        matchId: match.id,
        userId,
      })
      const selection = isFixedRosterContest(contest)
        ? null
        : resolveMockSelection({
            contestId: contest.id,
            matchId: match.id,
            userId,
            seedFromDefaultHasTeam: true,
          })
      return {
        ...match,
        hasTeam: isFixedRosterContest(contest)
          ? viewerPickNames.length > 0
          : !!selection?.playingXi?.length,
        submittedCount,
        joinedCount,
        viewerJoined,
      }
    })
    return res.json(rows)
  })

  router.get('/contests/:contestId/participants', (req, res) => {
    const contest = mockContests.find((item) => item.id === req.params.contestId)
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' })
    }
    const matchId = (req.query.matchId || 'm1').toString()
    const viewerUserId = (req.query.userId || '').toString()
    const contestMatches = getContestMatches(contest)
    const activeMatch =
      contestMatches.find((match) => match.id === matchId) || contestMatches[0]
    if (!activeMatch) {
      return res.json({ activeMatch: null, participants: [], previewXI })
    }
    const scoreIndex = buildContestMatchPointsIndex({ contest, matchId: activeMatch.id })
    const hasUploadedScore = Object.keys(scoreIndex).length > 0
    const fallbackScoreIndex =
      !hasUploadedScore && activeMatch.status !== 'notstarted'
        ? [
            ...getMatchRosters(activeMatch).teamA,
            ...getMatchRosters(activeMatch).teamB,
          ].reduce((acc, player) => {
            const key = normalizeUserKey(player.name)
            acc[key] =
              12 + ((nameHash(player.name) + Number(activeMatch.matchNo || 1) * 17) % 79)
            return acc
          }, {})
        : {}
    const effectiveScoreIndex = hasUploadedScore ? scoreIndex : fallbackScoreIndex
    const usersPool = getContestUserPool({
      contest,
      matchId: activeMatch.id,
      viewerUserId,
    })
    const joinedCount = getContestJoinedCount(contest.id)
    const participants = usersPool
      .map((seededUser, index) => {
        const userId = seededUser.userId
        const pickNames = resolveMatchUserPickNames({
          contestId: contest.id,
          matchId: activeMatch.id,
          userId,
        })
        const computedPoints = pickNames.reduce((sum, pickName) => {
          const key = normalizeUserKey(pickName)
          return sum + Number(effectiveScoreIndex[key] || 0)
        }, 0)
        return {
          id: `${userId}-${index + 1}`,
          userId,
          name: seededUser.name,
          points: computedPoints,
          canView: isFixedRosterContest(contest) ? true : activeMatch.status !== 'notstarted',
          hasTeam: isFixedRosterContest(contest) ? true : pickNames.length > 0,
        }
      })
      .filter((row) => row.hasTeam)
      .sort((a, b) => {
        const scoreDelta = Number(b.points || 0) - Number(a.points || 0)
        if (scoreDelta !== 0) return scoreDelta
        return a.name.localeCompare(b.name)
      })
    return res.json({
      activeMatch,
      joinedCount,
      withTeamCount: participants.length,
      participants,
      previewXI,
    })
  })

  router.get('/contests/:contestId/leaderboard', (req, res) => {
    const contest = mockContests.find((item) => item.id === req.params.contestId)
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' })
    }
    const usersPool = getContestUserPool({
      contest,
      matchId: 'm1',
      viewerUserId: '',
    })
    const computedRows = buildContestLeaderboardRowsFromUserPool({
      contest,
      usersPool,
    })
    return res.json({
      contest,
      rows: computedRows,
      previewXI,
    })
  })

  router.get('/contests/:contestId/users/:userId/match-scores', (req, res) => {
    const contest = mockContests.find((item) => item.id === req.params.contestId)
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' })
    }
    const userId = (req.params.userId || '').toString()
    const compareUserId = (req.query.compareUserId || '').toString()
    const rows = buildContestUserMatchRows({
      contest,
      userId,
      compareUserId,
    })
    const totals = rows.reduce(
      (acc, row) => {
        acc.userPoints += Number(row.userPoints || 0)
        acc.comparePoints += Number(row.comparePoints || 0)
        return acc
      },
      { userPoints: 0, comparePoints: 0 },
    )
    return res.json({
      contestId: contest.id,
      tournamentId: contest.tournamentId,
      userId,
      compareUserId,
      totals: {
        userPoints: totals.userPoints,
        comparePoints: totals.comparePoints,
        delta: totals.userPoints - totals.comparePoints,
      },
      rows,
    })
  })

  router.get('/tournaments/pretty', (req, res) => {
    return res.json(prettyTournament)
  })

  router.get('/players', (req, res) => {
    return res.json(allKnownPlayers)
  })

  router.get('/player-stats', (req, res) => {
    const tournamentId = (req.query.tournamentId || '').toString()
    const aggregateIndex = getTournamentPlayerStatsIndex(tournamentId)
    const rows = getTournamentPlayers(tournamentId).map((player) => {
      const aggregate = aggregateIndex[player.id] || null
      const teamMeta = getTeamSquadByCode(player.team)
      return {
        id: player.id,
        name: player.name,
        team: player.team,
        teamCode: player.team,
        teamName: teamMeta?.teamName || player.team,
        country: teamMeta?.country || '',
        league: teamMeta?.league || '',
        role: player.role,
        imageUrl: player.imageUrl || '',
        runs: Number(aggregate?.runs || 0),
        wickets: Number(aggregate?.wickets || 0),
        catches: Number(aggregate?.catches || 0),
        fours: Number(aggregate?.fours || 0),
        sixes: Number(aggregate?.sixes || 0),
        points: Number(aggregate?.totalPoints || 0),
      }
    })
    return res.json(rows)
  })

  router.get('/team-pool', (req, res) => {
    const contestId = (req.query.contestId || '').toString()
    const tournamentId = (req.query.tournamentId || '').toString()
    const matchId = (req.query.matchId || 'm1').toString()
    const userId = (req.query.userId || 'kiran11').toString()
    const actor = resolveTeamActor(req, userId)
    if (!actor) {
      return res.status(401).json({ message: 'Valid actorUserId required for team pool' })
    }
    const actorKey = normalizeActorId(
      actor?.userId || actor?.gameName || actor?.email || '',
    )
    const targetKey = normalizeActorId(userId)
    const isSelfRead = actorKey && targetKey && actorKey === targetKey
    if (!isSelfRead && actor.role !== 'master_admin') {
      return res.status(403).json({
        message: 'Only master admin can access another user full team.',
      })
    }
    const contest = mockContests.find((item) => item.id === contestId)
    const resolvedTournamentId = contest?.tournamentId || tournamentId || 't20wc-2026'
    const tournamentMatches = buildMatches(100, resolvedTournamentId)
    const activeMatch =
      tournamentMatches.find((match) => match.id === matchId) || tournamentMatches[0]
    const selection = resolveMockSelection({
      contestId,
      matchId,
      userId,
      seedFromDefaultHasTeam: true,
    })
    const matchRosters = getMatchRosters(activeMatch)
    const savedLineup =
      mockMatchLineups.get(
        lineupKey({
          tournamentId: contest?.tournamentId || '',
          contestId: contestId || '',
          matchId,
        }),
      ) || null
    const lineupA = savedLineup?.lineups?.[activeMatch.home] || null
    const lineupB = savedLineup?.lineups?.[activeMatch.away] || null
    return res.json({
      contest: contest || null,
      activeMatch,
      selection: selection || null,
      teams: {
        teamA: {
          name: activeMatch.home,
          players: matchRosters.teamA,
          lineup: lineupA,
        },
        teamB: {
          name: activeMatch.away,
          players: matchRosters.teamB,
          lineup: lineupB,
        },
      },
    })
  })

  router.get('/admin/match-lineups/:tournamentId/:matchId', (req, res) => {
    const tournamentId = (req.params.tournamentId || '').toString()
    const matchId = (req.params.matchId || '').toString()
    const contestId = (req.query.contestId || '').toString()
    if (!tournamentId || !matchId || !contestId) {
      return res.status(400).json({
        message: 'tournamentId, matchId and contestId are required',
      })
    }
    const contest = mockContests.find((item) => item.id === contestId)
    if (!contest) return res.status(404).json({ message: 'Contest not found' })
    if (contest.tournamentId !== tournamentId) {
      return res.status(400).json({
        message: 'contestId does not belong to tournamentId',
      })
    }
    const activeMatch = buildMatches(100, tournamentId).find(
      (item) => item.id === matchId,
    )
    if (!activeMatch) return res.status(404).json({ message: 'Match not found' })
    const saved =
      mockMatchLineups.get(
        lineupKey({
          tournamentId,
          contestId,
          matchId,
        }),
      ) || null
    return res.json({
      tournamentId,
      contestId,
      matchId,
      match: activeMatch,
      saved,
    })
  })

  router.post('/admin/match-lineups/upsert', (req, res) => {
    const tournamentId = (req.body?.tournamentId || '').toString()
    const contestId = (req.body?.contestId || '').toString()
    const matchId = (req.body?.matchId || '').toString()
    const source = (req.body?.source || 'manual-xi').toString()
    const updatedBy = (req.body?.updatedBy || req.body?.userId || 'admin').toString()
    const lineups =
      req.body?.lineups && typeof req.body.lineups === 'object' ? req.body.lineups : null
    const strictSquad = req.body?.strictSquad !== false

    if (!tournamentId || !contestId || !matchId) {
      return res.status(400).json({
        message: 'tournamentId, contestId and matchId are required',
      })
    }
    if (!lineups) {
      return res.status(400).json({ message: 'lineups object is required' })
    }

    const contest = mockContests.find((item) => item.id === contestId)
    if (!contest) return res.status(404).json({ message: 'Contest not found' })
    if (contest.tournamentId !== tournamentId) {
      return res.status(400).json({
        message: 'contestId does not belong to tournamentId',
      })
    }
    const activeMatch = buildMatches(100, tournamentId).find(
      (item) => item.id === matchId,
    )
    if (!activeMatch) return res.status(404).json({ message: 'Match not found' })

    const teamCodes = [activeMatch.home, activeMatch.away]
    const extraTeams = Object.keys(lineups).filter(
      (teamCode) => !teamCodes.includes(teamCode),
    )
    if (extraTeams.length) {
      return res.status(400).json({
        message: `lineups contains invalid team keys: ${extraTeams.join(', ')}`,
      })
    }
    const missingTeams = teamCodes.filter((teamCode) => !lineups[teamCode])
    if (missingTeams.length) {
      return res.status(400).json({
        message: `lineups missing required team keys: ${missingTeams.join(', ')}`,
      })
    }

    const matchRosters = getMatchRosters(activeMatch)
    const fallbackByTeam = {
      [activeMatch.home]: matchRosters.teamA.map((player) => player.name),
      [activeMatch.away]: matchRosters.teamB.map((player) => player.name),
    }
    const normalizedLineups = {}
    for (const teamCode of teamCodes) {
      const result = validateLineupTeamPayload({
        teamCode,
        payload: lineups[teamCode],
        fallbackSquad: fallbackByTeam[teamCode],
        strictSquad,
      })
      if (!result.ok) {
        return res.status(400).json({ message: result.message })
      }
      normalizedLineups[teamCode] = result.value
    }

    const payload = {
      tournamentId,
      contestId,
      matchId,
      source,
      updatedBy,
      updatedAt: new Date().toISOString(),
      lineups: normalizedLineups,
      meta: req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : {},
    }

    mockMatchLineups.set(lineupKey(payload), payload)
    appendAuditLog({
      actor: updatedBy,
      action: 'Saved match lineup',
      target: `${contestId} • ${matchId}`,
      detail: `${activeMatch.home} and ${activeMatch.away} playing XI updated`,
      tournamentId,
      module: 'lineups',
    })
    persistState()
    return res.json({
      ok: true,
      saved: payload,
    })
  })

  router.post('/team-selection/save', (req, res) => {
    const contestId = (req.body?.contestId || '').toString()
    const matchId = (req.body?.matchId || '').toString()
    const userId = (req.body?.userId || '').toString()
    const playingXi = Array.isArray(req.body?.playingXi) ? req.body.playingXi : []
    const backups = Array.isArray(req.body?.backups) ? req.body.backups : []
    const contest = mockContests.find((item) => item.id === contestId)

    if (!contestId || !matchId || !userId) {
      return res
        .status(400)
        .json({ message: 'contestId, matchId and userId are required' })
    }
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found' })
    }
    if (isFixedRosterContest(contest)) {
      return res.status(403).json({ message: 'Fixed-roster contests cannot save match-wise teams' })
    }
    const actor = resolveTeamActor(req, userId)
    if (!actor) {
      return res.status(401).json({ message: 'Valid actorUserId required for team save' })
    }
    const actorKey = normalizeActorId(
      actor?.userId || actor?.gameName || actor?.email || '',
    )
    const targetKey = normalizeActorId(userId)
    const isSelfEdit = actorKey && targetKey && actorKey === targetKey
    if (!isSelfEdit && actor.role !== 'master_admin') {
      return res.status(403).json({
        message:
          'Only master admin can edit another user full team. Admin can do replacement only.',
      })
    }
    if (playingXi.length !== 11) {
      return res.status(400).json({ message: 'playingXi must have 11 players' })
    }
    if (backups.length > 6) {
      return res.status(400).json({ message: 'backups must be 0-6 players' })
    }

    const payload = {
      contestId,
      matchId,
      userId,
      playingXi,
      backups,
      updatedAt: new Date().toISOString(),
    }
    mockTeamSelections.set(selectionKey(payload), payload)
    persistState()
    return res.json({
      ok: true,
      message: 'Team saved',
      selection: payload,
    })
  })

  router.get('/match-options', (req, res) => {
    const tournamentId = (req.query.tournamentId || 't20wc-2026').toString()
    const options = buildMatches(30, tournamentId).map((match) => ({
      id: match.id,
      label: `${match.name}`,
      home: match.home,
      away: match.away,
      date: match.date,
    }))
    return res.json(options)
  })

  router.get('/admin/match-score-context', (req, res) => {
    const tournamentId = (
      req.query.tournamentId ||
      mockTournaments[0]?.id ||
      ''
    ).toString()
    const matches = buildMatches(30, tournamentId).map((match) => ({
      ...match,
      tournamentId,
    }))
    return res.json({
      tournaments: mockTournaments,
      selectedTournamentId: tournamentId,
      matches,
    })
  })

  router.get('/admin/match-scores/:tournamentId/:matchId', (req, res) => {
    const tournamentId = (req.params.tournamentId || '').toString()
    const matchId = (req.params.matchId || '').toString()
    const activeScore = matchScores
      .filter((row) => row.active)
      .find(
        (row) =>
          row.tournamentId?.toString() === tournamentId &&
          row.matchId?.toString() === matchId,
      )
    return res.json(activeScore || null)
  })

  router.get('/users/:userId/picks', (req, res) => {
    const { userId } = req.params
    const tournamentId = (req.query.tournamentId || '').toString()
    const contestId = (req.query.contestId || '').toString()
    const matchId = (req.query.matchId || '').toString()
    const contest = mockContests.find((item) => item.id === contestId) || null
    const selection = matchId
      ? isFixedRosterContest(contest)
        ? null
        : resolveMockSelection({
            contestId,
            matchId,
            userId,
            seedFromDefaultHasTeam: true,
          })
      : null
    const idToName = new Map(allKnownPlayers.map((player) => [player.id, player.name]))
    const matchPointsByName = getMatchPlayerPointsByName({
      tournamentId,
      matchId,
    })
    const hasUploadedMatchPoints = Object.keys(matchPointsByName).length > 0
    const fallbackMatchPointsByName =
      !hasUploadedMatchPoints && matchId
        ? (() => {
            const activeMatch =
              buildMatches(100, tournamentId || 't20wc-2026').find(
                (item) => item.id === matchId,
              ) || null
            if (!activeMatch || activeMatch.status === 'notstarted') return {}
            return [
              ...getMatchRosters(activeMatch).teamA,
              ...getMatchRosters(activeMatch).teamB,
            ].reduce((acc, player) => {
              const key = normalizeUserKey(player.name)
              acc[key] =
                12 +
                ((nameHash(player.name) + Number(activeMatch.matchNo || 1) * 17) % 79)
              return acc
            }, {})
          })()
        : {}
    const effectiveMatchPointsByName = hasUploadedMatchPoints
      ? matchPointsByName
      : fallbackMatchPointsByName
    const pointsByPlayerId = getTournamentPlayerStatsIndex(tournamentId)
    const fixedRoster = contest && isFixedRosterContest(contest)
      ? getFixedRosterNames({ contest, userId, matchId })
      : null
    const picks = fixedRoster
      ? fixedRoster.roster
      : selection?.playingXi?.map((id) => idToName.get(id)).filter(Boolean) || []
    const backups = fixedRoster
      ? fixedRoster.rest
      : selection?.backups?.map((id) => idToName.get(id)).filter(Boolean) || []
    const picksDetailed = picks.map((name) => {
      const found = allKnownPlayers.find((item) => item.name === name)
      const matchPoints = Number(effectiveMatchPointsByName[normalizeUserKey(name)] || 0)
      const livePoints = found?.id
        ? Number(pointsByPlayerId[found.id]?.totalPoints || 0)
        : 0
      return {
        name,
        role: found?.role || '-',
        team: found?.team || '-',
        imageUrl: found?.imageUrl || '',
        points: matchId ? matchPoints : livePoints,
      }
    })
    const backupsDetailed = backups.map((name) => {
      const found = allKnownPlayers.find((item) => item.name === name)
      const matchPoints = Number(effectiveMatchPointsByName[normalizeUserKey(name)] || 0)
      const livePoints = found?.id
        ? Number(pointsByPlayerId[found.id]?.totalPoints || 0)
        : 0
      return {
        name,
        role: found?.role || '-',
        team: found?.team || '-',
        imageUrl: found?.imageUrl || '',
        points: matchId ? matchPoints : livePoints,
      }
    })
    return res.json({
      userId,
      tournamentId,
      contestId,
      matchId,
      tournamentName: prettyTournament[tournamentId] || tournamentId,
      picks,
      backups,
      picksDetailed,
      backupsDetailed,
    })
  })

  const upsertManualMatchScore = ({
    tournamentId,
    matchId,
    playerStatsRows,
    teamScore,
    uploadedBy = 'manual-admin',
    source = 'manual',
  }) => {
    const normalizedRows = normalizePlayerStatRows(playerStatsRows, allKnownPlayers)
    if (!normalizedRows.length) {
      return {
        error: { status: 400, message: 'Valid playerStats required' },
      }
    }

    matchScores.forEach((row) => {
      const sameMatch = row.matchId?.toString() === matchId?.toString()
      const sameTournament = row.tournamentId?.toString() === tournamentId?.toString()
      if (sameMatch && sameTournament) {
        row.active = false
      }
    })

    const payload = {
      id: getNextMatchScoreId(),
      matchId,
      tournamentId,
      playerStats: normalizedRows,
      teamScore: teamScore || {},
      uploadedBy,
      source,
      active: true,
      createdAt: new Date().toISOString(),
    }
    matchScores.push(payload)

    const pointsIndex = getPlayerPointsIndex(tournamentId)
    const topPlayers = Object.values(pointsIndex)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 5)
    const tournamentContests = mockContests.filter(
      (contest) => contest.tournamentId === tournamentId,
    )
    const contestSummaries = tournamentContests.map((contest) => ({
      contestId: contest.id,
      rows: buildContestLeaderboardRowsFromUserPool({
        contest,
        usersPool: getContestUserPool({ contest, matchId: 'm1' }),
      }).slice(0, 3),
    }))

    return {
      payload,
      topPlayers,
      contestSummaries,
      lastScoreUpdatedAt: payload.createdAt,
      impactedContests: contestSummaries.length,
    }
  }

  router.post('/admin/match-scores/upsert', (req, res) => {
    const {
      tournamentId,
      contestId,
      matchId,
      userId,
      teamScore,
      playerStats: incomingRows,
    } = req.body || {}
    if (!tournamentId || !matchId) {
      return res.status(400).json({ message: 'tournamentId and matchId required' })
    }
    const actor = resolveActorUser(userId)
    if (!actor) {
      return res.status(401).json({ message: 'Valid userId required for score update' })
    }
    const requestedContestId = (contestId || '').toString().trim()
    const scopedContestId =
      requestedContestId ||
      mockContests.find((item) => item.tournamentId === tournamentId.toString())?.id ||
      ''
    if (actor.role === 'contest_manager') {
      const assignedContestId = (actor.contestManagerContestId || '').toString().trim()
      const assignedContest = mockContests.find((item) => item.id === assignedContestId)
      if (!assignedContest || assignedContest.tournamentId !== tournamentId.toString()) {
        return res.status(403).json({
          message: 'Not allowed. Score manager can update only assigned contest scores.',
        })
      }
      if (requestedContestId && requestedContestId !== assignedContestId) {
        return res.status(403).json({
          message: 'Not allowed. Score manager can update only assigned contest scores.',
        })
      }
    } else if (!canWriteScoresForContest(actor, scopedContestId)) {
      return res.status(403).json({ message: 'Not allowed to update scores.' })
    }
    if (!Array.isArray(incomingRows)) {
      return res.status(400).json({ message: 'playerStats array required' })
    }

    const result = upsertManualMatchScore({
      tournamentId: tournamentId.toString(),
      matchId: matchId.toString(),
      playerStatsRows: incomingRows,
      teamScore,
      source: 'manual-json',
    })

    if (result.error) {
      return res.status(result.error.status).json({ message: result.error.message })
    }

    appendAuditLog({
      actor: actor.name || actor.gameName || 'Score manager',
      action: 'Uploaded manual match score',
      target: `${scopedContestId || tournamentId} • ${matchId}`,
      detail: 'Manual score entry saved via admin panel',
      tournamentId: tournamentId.toString(),
      module: 'scoring',
    })
    persistState()

    return res.json({
      ok: true,
      savedAt: new Date().toISOString(),
      savedScore: result.payload,
      topPlayers: result.topPlayers,
      contestSummaries: result.contestSummaries,
      lastScoreUpdatedAt: result.lastScoreUpdatedAt,
      impactedContests: result.impactedContests,
    })
  })

  router.post('/scoring-rules/save', (req, res) => {
    const { rules } = req.body || {}
    if (!rules || typeof rules !== 'object') {
      return res.status(400).json({ message: 'Rules payload required' })
    }
    dashboardMockData.pointsRuleTemplate = rules
    persistState()
    return res.json({ ok: true, savedAt: new Date().toISOString() })
  })

  router.post('/match-scores/process-excel', (req, res) => {
    const { fileName } = req.body || {}
    if (!fileName) {
      return res.status(400).json({ message: 'Excel file required before processing' })
    }
    const processedStats = playerStats.map((row) => ({
      playerId: row.id,
      runs: row.runs,
      wickets: row.wickets,
      catches: row.id === 'p1' ? 1 : row.id === 'p2' ? 2 : 0,
      fours: row.id === 'p1' ? 4 : row.id === 'p2' ? 6 : 2,
      sixes: row.id === 'p1' ? 2 : row.id === 'p2' ? 3 : 1,
    }))
    return res.json({
      ok: true,
      fileName,
      processedRows: processedStats.length,
      playerStats: processedStats,
      processedAt: new Date().toISOString(),
    })
  })

  router.post('/match-scores/save', (req, res) => {
    const {
      payloadText,
      fileName,
      processedPayload,
      source,
      tournamentId,
      contestId,
      matchId,
      userId,
      teamScore,
    } = req.body || {}
    const hasProcessedStats =
      Array.isArray(processedPayload?.playerStats) &&
      processedPayload.playerStats.length > 0
    if (!payloadText && !fileName && !hasProcessedStats && !tournamentId && !matchId) {
      return res.status(400).json({ message: 'JSON or Excel payload required' })
    }

    let manualResult = null
    if (tournamentId && matchId) {
      const actor = resolveActorUser(userId)
      if (!actor) {
        return res.status(401).json({ message: 'Valid userId required for score update' })
      }
      const requestedContestId = (contestId || '').toString().trim()
      const scopedContestId =
        requestedContestId ||
        mockContests.find((item) => item.tournamentId === tournamentId.toString())?.id ||
        ''
      if (actor.role === 'contest_manager') {
        const assignedContestId = (actor.contestManagerContestId || '').toString().trim()
        const assignedContest = mockContests.find((item) => item.id === assignedContestId)
        if (
          !assignedContest ||
          assignedContest.tournamentId !== tournamentId.toString()
        ) {
          return res.status(403).json({
            message:
              'Not allowed. Score manager can update only assigned contest scores.',
          })
        }
        if (requestedContestId && requestedContestId !== assignedContestId) {
          return res.status(403).json({
            message:
              'Not allowed. Score manager can update only assigned contest scores.',
          })
        }
      } else if (!canWriteScoresForContest(actor, scopedContestId)) {
        return res.status(403).json({ message: 'Not allowed to update scores.' })
      }
      let parsedPayload = {}
      if (typeof payloadText === 'string' && payloadText.trim()) {
        try {
          parsedPayload = JSON.parse(payloadText)
        } catch {
          return res.status(400).json({ message: 'Invalid JSON payloadText' })
        }
      }
      const rows =
        processedPayload?.playerStats ||
        parsedPayload?.playerStats ||
        req.body?.playerStats
      if (!Array.isArray(rows)) {
        return res.status(400).json({ message: 'playerStats required for match upsert' })
      }
      manualResult = upsertManualMatchScore({
        tournamentId: tournamentId.toString(),
        matchId: matchId.toString(),
        playerStatsRows: rows,
        teamScore: teamScore || parsedPayload?.teamScore || {},
        source: source || 'manual',
      })
      if (manualResult.error) {
        return res
          .status(manualResult.error.status)
          .json({ message: manualResult.error.message })
      }
    }

    const targetLabel =
      fileName || (source === 'excel' ? 'Excel payload' : 'JSON payload')
    appendAuditLog({
      actor: resolveActorUser(userId)?.name || userId || 'Score manager',
      action: 'Saved match score payload',
      target: targetLabel,
      detail:
        source === 'excel' ? 'Excel payload processed and saved' : 'JSON payload saved',
      tournamentId: tournamentId ? tournamentId.toString() : 'global',
      module: 'scoring',
    })
    persistState()
    return res.json({
      ok: true,
      savedAt: new Date().toISOString(),
      ...(manualResult
        ? {
            savedScore: manualResult.payload,
            topPlayers: manualResult.topPlayers,
            contestSummaries: manualResult.contestSummaries,
            lastScoreUpdatedAt: manualResult.lastScoreUpdatedAt,
            impactedContests: manualResult.impactedContests,
          }
        : {}),
    })
  })

  router.get('/admin/player-overrides/context', (req, res) => {
    const contestId = (req.query.contestId || 'huntercherry').toString()
    const matchId = (req.query.matchId || 'm1').toString()
    const contest = mockContests.find((item) => item.id === contestId)
    const contestMatches = getContestMatches(contest)
    const activeMatch =
      contestMatches.find((match) => match.id === matchId) || contestMatches[0]
    if (!activeMatch) {
      return res.status(404).json({ message: 'No matches configured for contest' })
    }

    const usersWithPicks = Object.keys(sampleUserPicks).map((userId) => {
      const selection = resolveMockSelection({
        contestId,
        matchId,
        userId,
        seedFromDefaultHasTeam: true,
      })
      const picks = (selection?.playingXi || [])
        .map((playerId) => idToPlayerName.get(playerId))
        .filter(Boolean)
      const replacementOptions = allPlayerNames.filter((name) => !picks.includes(name))
      return {
        userId,
        displayName: userId.replace(/-/g, ' '),
        picks,
        replacementOptions,
      }
    })

    return res.json({
      matchId: activeMatch.id,
      matchLabel: activeMatch.name,
      contestId,
      isLocked: activeMatch.status !== 'notstarted',
      replacementPool: allPlayerNames,
      users: usersWithPicks,
    })
  })

  router.post('/admin/player-overrides/save', (req, res) => {
    const {
      userId,
      outPlayer,
      inPlayer,
      contestId = 'huntercherry',
      matchId = 'm1',
    } = req.body || {}
    if (!userId || !outPlayer || !inPlayer) {
      return res.status(400).json({ message: 'userId, outPlayer and inPlayer required' })
    }
    const actor = resolveAdminActor(req)
    if (!actor || !['admin', 'master_admin'].includes(actor.role)) {
      return res
        .status(403)
        .json({ message: 'Only admin/master can save manual replacements' })
    }
    if (!allPlayerNames.includes(inPlayer)) {
      return res.status(400).json({ message: 'Replacement must be a valid player' })
    }
    const selection = resolveMockSelection({
      contestId: contestId.toString(),
      matchId: matchId.toString(),
      userId: userId.toString(),
      seedFromDefaultHasTeam: true,
    })
    const picks = selection?.playingXi
      ?.map((id) => idToPlayerName.get(id))
      .filter(Boolean)
    if (!Array.isArray(picks) || !picks.length) {
      return res.status(404).json({ message: 'User picks not found' })
    }
    if (!picks.includes(outPlayer)) {
      return res.status(400).json({ message: 'Outgoing player not found in user picks' })
    }
    if (picks.includes(inPlayer)) {
      return res
        .status(400)
        .json({ message: 'Incoming player already exists in user picks' })
    }

    const updated = picks.map((name) => (name === outPlayer ? inPlayer : name))
    sampleUserPicks[userId] = updated
    const updatedSelection = {
      contestId: contestId.toString(),
      matchId: matchId.toString(),
      userId: userId.toString(),
      playingXi: namesToPlayerIds(updated).slice(0, 11),
      backups: selection?.backups || [],
      updatedAt: new Date().toISOString(),
    }
    mockTeamSelections.set(selectionKey(updatedSelection), updatedSelection)
    const targetContest = mockContests.find((item) => item.id === contestId.toString())
    appendAuditLog({
      actor: actor?.gameName || actor?.name || 'Admin',
      action: 'Manual player override',
      target: `${userId} (${matchId}): ${outPlayer} -> ${inPlayer}`,
      detail: 'Admin replaced non-playing user pick',
      tournamentId: targetContest?.tournamentId || 'global',
      module: 'overrides',
    })
    persistState()

    return res.json({
      ok: true,
      userId,
      updatedPicks: updated,
      savedAt: new Date().toISOString(),
    })
  })
}

export { registerMockProviderRoutes }
