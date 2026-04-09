import {
  buildMatches,
  contests as mockContests,
  contestJoins,
  customMatchSquads,
  customTournamentMatches,
  dashboardMockData,
  flowSeedMatchScores,
  flowSeedTeamSelections,
  buildSquadPlayersForTeam,
  playerStats,
  players,
  prettyTournament,
  previewXI,
  sampleUserPicks,
  tournaments as mockTournaments,
  teamSquads,
} from '../../mocks/mockData.js'
import {
  users,
  scoringRules,
  matchScores,
  getNextUserId,
  getNextMatchScoreId,
} from '../store.js'
import {
  calculateFantasyPoints,
  buildPlayerPointsIndex,
  getRuleSetForTournament,
  normalizePlayerStatRows,
  resolveEffectiveSelection,
} from '../scoring.js'

const providerContextResetters = new Set()

const resetMockProviderContexts = () => {
  providerContextResetters.forEach((resetter) => resetter())
}

const createMockProviderContext = ({
  seedProviderEnabled = true,
  autoSeedTeams = false,
  persistSeedState = () => {},
}) => {
  const mockTeamSelections = new Map()
  const mockMatchLineups = new Map()
  let dynamicPlayerId = 100000
  const normalizePlayerName = (value = '') =>
    value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  const baseKnownPlayers = [...players].filter(
    (player, index, arr) => arr.findIndex((item) => item.id === player.id) === index,
  )
  const allKnownPlayers = [...baseKnownPlayers]
  const normalizedPlayerMap = new Map(
    allKnownPlayers.map((player) => [normalizePlayerName(player.name), player]),
  )
  const idToPlayerName = new Map(
    allKnownPlayers.map((player) => [player.id, player.name]),
  )
  const allPlayerNames = Array.from(new Set(allKnownPlayers.map((player) => player.name)))
  const resetContextState = () => {
    mockTeamSelections.clear()
    mockMatchLineups.clear()
    dynamicPlayerId = 100000
    allKnownPlayers.length = 0
    allKnownPlayers.push(...baseKnownPlayers)
    normalizedPlayerMap.clear()
    idToPlayerName.clear()
    const uniqueNames = new Set()
    allKnownPlayers.forEach((player) => {
      normalizedPlayerMap.set(normalizePlayerName(player.name), player)
      idToPlayerName.set(player.id, player.name)
      uniqueNames.add(player.name)
    })
    allPlayerNames.length = 0
    allPlayerNames.push(...uniqueNames)
  }
  providerContextResetters.add(resetContextState)
  const ensureDynamicPlayer = ({ name = '', team = '', role = 'BAT' }) => {
    const normalized = normalizePlayerName(name)
    if (!normalized) return null
    const existing = normalizedPlayerMap.get(normalized)
    if (existing) return existing
    dynamicPlayerId += 1
    const created = {
      id: `p-dyn-${dynamicPlayerId}`,
      name: name.toString().trim(),
      role,
      team: team.toString().trim() || 'TBD',
      points: 0,
      trend: 0,
      recent: [0, 0, 0, 0, 0],
    }
    allKnownPlayers.push(created)
    normalizedPlayerMap.set(normalized, created)
    idToPlayerName.set(created.id, created.name)
    allPlayerNames.push(created.name)
    return created
  }
  const normalizeImportedSquadEntry = (entry, fallbackTeam = '') => {
    if (!entry) return null
    if (typeof entry === 'string') {
      return ensureDynamicPlayer({ name: entry, team: fallbackTeam || 'TBD' })
    }
    if (typeof entry !== 'object') return null
    const rawName =
      entry.name || entry.playerName || entry.fullName || entry.displayName || ''
    const normalized = normalizePlayerName(rawName)
    if (!normalized) return null
    const existing = normalizedPlayerMap.get(normalized)
    if (existing) {
      return {
        ...existing,
        role: entry.role || existing.role || 'BAT',
        team: entry.team || entry.teamCode || existing.team || fallbackTeam || 'TBD',
        teamName:
          entry.teamName || existing.teamName || existing.team || fallbackTeam || '',
        imageUrl: entry.imageUrl || existing.imageUrl || '',
      }
    }
    dynamicPlayerId += 1
    const created = {
      id: entry.id || `p-dyn-${dynamicPlayerId}`,
      name: rawName.toString().trim(),
      role: (entry.role || 'BAT').toString().trim(),
      team: (entry.team || entry.teamCode || fallbackTeam || 'TBD').toString().trim(),
      teamName: (entry.teamName || entry.team || entry.teamCode || fallbackTeam || '')
        .toString()
        .trim(),
      imageUrl: (entry.imageUrl || '').toString().trim(),
      country: (entry.country || entry.nationality || '').toString().trim(),
      points: Number(entry.points || 0),
      trend: Number(entry.trend || 0),
      recent: Array.isArray(entry.recent) ? entry.recent : [0, 0, 0, 0, 0],
    }
    allKnownPlayers.push(created)
    normalizedPlayerMap.set(normalized, created)
    idToPlayerName.set(created.id, created.name)
    allPlayerNames.push(created.name)
    return created
  }
  const registerKnownPlayer = (player) => {
    if (!player?.id || !player?.name) return player || null
    if (!allKnownPlayers.some((item) => item.id === player.id)) {
      allKnownPlayers.push(player)
    }
    normalizedPlayerMap.set(normalizePlayerName(player.name), player)
    idToPlayerName.set(player.id, player.name)
    if (!allPlayerNames.includes(player.name)) {
      allPlayerNames.push(player.name)
    }
    return player
  }
  const getTeamRoster = (teamCode) => {
    const roster = buildSquadPlayersForTeam(teamCode)
    if (roster.length) return roster.map((player) => registerKnownPlayer(player))
    return players
      .filter((player) => player.team === teamCode)
      .map((player) => registerKnownPlayer(player))
  }
  const getMatchRosters = (match) => {
    const liveRosterA = getTeamRoster(match?.home || 'IND')
    const liveRosterB = getTeamRoster(match?.away || 'AUS')
    const squadA = Array.isArray(match?.squadA) ? match.squadA : []
    const squadB = Array.isArray(match?.squadB) ? match.squadB : []
    const pickFromSquad = (names, fallback, teamCode) => {
      if (fallback.length) return fallback
      if (!names.length) return fallback
      return names
        .map((entry) => normalizeImportedSquadEntry(entry, teamCode || 'TBD'))
        .filter(Boolean)
    }
    return {
      teamA: pickFromSquad(squadA, liveRosterA, match?.home || ''),
      teamB: pickFromSquad(squadB, liveRosterB, match?.away || ''),
    }
  }
  const selectionKey = ({ contestId, matchId, userId }) =>
    `${contestId}::${matchId}::${userId}`
  const lineupKey = ({ tournamentId, matchId }) => `${tournamentId}::${matchId}`
  const nameHash = (value = '') =>
    value
      .toString()
      .split('')
      .reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const getFallbackPickNames = (userId) => sampleUserPicks[userId] || previewXI
  const tournamentCatalog = [
    ...mockTournaments.map((item) => ({
      ...item,
      sourceKey: item.id,
      season: item.season || '2026',
    })),
    {
      id: 'hundred-2026',
      name: 'The Hundred 2026',
      sourceKey: 'hundred-2026',
      season: '2026',
    },
    {
      id: 'sa20-2026',
      name: 'SA20 2026',
      sourceKey: 'sa20-2026',
      season: '2026',
    },
  ]
  const ensureCoreContestUsers = () => {
    const byGameName = new Set(
      users
        .map((user) => (user?.gameName || '').toString().trim().toLowerCase())
        .filter(Boolean),
    )
    const coreUsers = [
      {
        gameName: 'master',
        name: 'Master Admin',
        email: 'master@myxi.local',
        role: 'master_admin',
        contestManagerContestId: null,
      },
      {
        gameName: 'admin',
        name: 'Admin User',
        email: 'admin@myxi.local',
        role: 'admin',
        contestManagerContestId: null,
      },
      {
        gameName: 'player',
        name: 'Player User',
        email: 'player@myxi.local',
        role: 'user',
        contestManagerContestId: null,
      },
      {
        gameName: 'contestmgr',
        name: 'Score Manager',
        email: 'contestmgr@myxi.local',
        role: 'contest_manager',
        contestManagerContestId: 'huntercherry',
      },
    ]
    coreUsers.forEach((coreUser) => {
      if (byGameName.has(coreUser.gameName)) return
      users.push({
        id: getNextUserId(),
        name: coreUser.name,
        userId: coreUser.gameName,
        gameName: coreUser.gameName,
        email: coreUser.email,
        passwordHash: '',
        status: 'active',
        role: coreUser.role,
        contestManagerContestId: coreUser.contestManagerContestId,
        createdAt: new Date().toISOString(),
      })
      byGameName.add(coreUser.gameName)
    })
    const contestManagerUser = users.find(
      (user) => (user?.gameName || '').toString().trim().toLowerCase() === 'contestmgr',
    )
    if (contestManagerUser) {
      const assignedId = (contestManagerUser.contestManagerContestId || '')
        .toString()
        .trim()
      const assignedExists = mockContests.some((contest) => contest.id === assignedId)
      if (!assignedExists) {
        contestManagerUser.contestManagerContestId = 'huntercherry'
      }
    }
  }
  const ensureRegisteredUserPool = (minimumCount = 0) => {
    const normalizedMinimum = Math.max(0, Number(minimumCount || 0))
    if (!normalizedMinimum) return
    let registeredCount = 0
    const existingNames = new Set()
    users.forEach((user) => {
      const gameName = (user?.gameName || '').toString().trim()
      if (!gameName) return
      registeredCount += 1
      existingNames.add(gameName.toLowerCase())
    })
    let nextIndex = registeredCount + 1
    while (registeredCount < normalizedMinimum) {
      const serial = String(nextIndex).padStart(3, '0')
      const candidate = `player${serial}`
      const normalized = candidate.toLowerCase()
      nextIndex += 1
      if (existingNames.has(normalized)) continue
      users.push({
        id: getNextUserId(),
        name: `Player ${serial}`,
        userId: candidate,
        gameName: candidate,
        email: `${candidate}@myxi.local`,
        passwordHash: '',
        status: 'active',
        role: 'user',
        contestManagerContestId: null,
        createdAt: new Date().toISOString(),
      })
      existingNames.add(normalized)
      registeredCount += 1
    }
  }
  const enabledTournamentIds = new Set(mockTournaments.map((item) => item.id))
  const mockContestCatalog = new Map(
    mockContests.map((contest) => [contest.id, { ...contest }]),
  )
  const ensureFlowCupSeed = () => {
    const flowTournamentId = 'flow-cup-2026'
    if (!mockTournaments.some((item) => item.id === flowTournamentId)) {
      mockTournaments.push({
        id: flowTournamentId,
        name: 'Flow Cup 2026',
        season: '2026',
        source: 'seed',
        createdBy: 'system',
        lastUpdatedAt: '2026-02-01T00:00:00.000Z',
      })
    }
    if (!tournamentCatalog.some((item) => item.id === flowTournamentId)) {
      tournamentCatalog.push({
        id: flowTournamentId,
        name: 'Flow Cup 2026',
        season: '2026',
        source: 'seed',
        createdBy: 'system',
        sourceKey: flowTournamentId,
        lastUpdatedAt: '2026-02-01T00:00:00.000Z',
      })
    }
    if (
      !Array.isArray(customTournamentMatches[flowTournamentId]) ||
      !customTournamentMatches[flowTournamentId].length
    ) {
      customTournamentMatches[flowTournamentId] = [
        {
          id: 'm1',
          matchNo: 1,
          home: 'IND',
          away: 'AUS',
          name: 'Match 1: IND vs AUS',
          date: '2026-02-10',
          startAt: '2026-02-10T14:00:00.000Z',
          status: 'completed',
          stage: 'league',
          stageLabel: 'League',
          venue: 'Mumbai',
        },
        {
          id: 'm2',
          matchNo: 2,
          home: 'IND',
          away: 'ENG',
          name: 'Match 2: IND vs ENG',
          date: '2026-02-14',
          startAt: '2026-02-14T14:00:00.000Z',
          status: 'inprogress',
          stage: 'league',
          stageLabel: 'League',
          venue: 'Delhi',
        },
        {
          id: 'm3',
          matchNo: 3,
          home: 'IND',
          away: 'NZ',
          name: 'Match 3: IND vs NZ',
          date: '2026-03-01',
          startAt: '2026-03-01T14:00:00.000Z',
          status: 'notstarted',
          stage: 'league',
          stageLabel: 'League',
          venue: 'Chennai',
        },
      ]
    }
    if (!Array.isArray(customMatchSquads[flowTournamentId])) {
      customMatchSquads[flowTournamentId] = []
    }
    if (!mockContests.some((contest) => contest.id === 'huntercherry')) {
      const hunter = {
        id: 'huntercherry',
        name: 'Huntercherry Contest',
        tournamentId: 't20wc-2026',
        game: 'Fantasy',
        teams: 63,
        status: 'Starting Soon',
        joined: true,
        points: 321,
        rank: 32,
        createdBy: 'master',
        matchIds: ['m1', 'm2', 'm3'],
      }
      mockContests.unshift(hunter)
      mockContestCatalog.set(hunter.id, { ...hunter })
    }
    if (!mockContests.some((contest) => contest.id === 'flow-alpha')) {
      const flowContest = {
        id: 'flow-alpha',
        name: 'Flow Alpha Contest',
        tournamentId: flowTournamentId,
        game: 'Fantasy',
        teams: 20,
        status: 'Open',
        joined: true,
        points: 0,
        rank: '-',
        createdBy: 'master',
        matchIds: ['m1', 'm2', 'm3'],
      }
      mockContests.unshift(flowContest)
      mockContestCatalog.set(flowContest.id, { ...flowContest })
    }
    ;['master', 'admin', 'player', 'sreecharan', 'kiran11'].forEach((userId) => {
      const current = Array.isArray(contestJoins[userId]) ? contestJoins[userId] : []
      if (!current.includes('flow-alpha')) {
        contestJoins[userId] = [...current, 'flow-alpha']
      }
    })
    enabledTournamentIds.add(flowTournamentId)
  }
  ensureFlowCupSeed()
  const ensureLeagueSquadsSeed = () => {
    const leagueSeedRows = [
      {
        teamCode: 'CSK',
        teamName: 'Chennai Super Kings',
        country: 'india',
        league: 'IPL',
      },
      {
        teamCode: 'RCB',
        teamName: 'Royal Challengers Bengaluru',
        country: 'india',
        league: 'IPL',
      },
      {
        teamCode: 'MI',
        teamName: 'Mumbai Indians',
        country: 'india',
        league: 'IPL',
      },
      {
        teamCode: 'KKR',
        teamName: 'Kolkata Knight Riders',
        country: 'india',
        league: 'IPL',
      },
    ]
    leagueSeedRows.forEach((seed) => {
      const exists = teamSquads.some((item) => item.teamCode === seed.teamCode)
      if (exists) return
      teamSquads.push({
        teamCode: seed.teamCode,
        teamName: seed.teamName,
        tournamentType: 'league',
        country: seed.country,
        league: seed.league,
        tournament: 'IPL 2026',
        source: 'seed',
        lastUpdatedAt: new Date().toISOString(),
        squad: Array.from({ length: 15 }).map((_, index) => ({
          name: `${seed.teamCode} Player ${index + 1}`,
          active: true,
        })),
      })
    })
  }
  ensureLeagueSquadsSeed()
  const ensureInternationalSquadMetadata = () => {
    const labelByCode = {
      AFG: 'Afghanistan',
      AUS: 'Australia',
      CAN: 'Canada',
      ENG: 'England',
      IND: 'India',
      IRE: 'Ireland',
      ITA: 'Italy',
      NAM: 'Namibia',
      NEP: 'Nepal',
      NED: 'Netherlands',
      NZ: 'New Zealand',
      OMA: 'Oman',
      PAK: 'Pakistan',
      SCO: 'Scotland',
      SA: 'South Africa',
      SL: 'Sri Lanka',
      UAE: 'United Arab Emirates',
      USA: 'United States',
      WI: 'West Indies',
      ZIM: 'Zimbabwe',
    }
    Object.entries(labelByCode).forEach(([teamCode, label]) => {
      const row = teamSquads.find((item) => item.teamCode === teamCode)
      if (!row) return
      if (!row.teamName || row.teamName === teamCode) row.teamName = label
      if (!row.country) row.country = label.toLowerCase()
      if (!row.tournamentType) row.tournamentType = 'international'
    })
  }
  ensureInternationalSquadMetadata()
  let nextMockContestId = 1
  const buildMockContestId = (name = '') => {
    const slug = name
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const fallback = `contest-${nextMockContestId}`
    nextMockContestId += 1
    return slug || fallback
  }
  const appendAuditLog = ({
    actor = 'System',
    action = '',
    target = '',
    detail = '',
    tournamentId = 'global',
    module = 'admin',
  }) => {
    dashboardMockData.auditLogs.unshift({
      id: `log-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      actor,
      action,
      target,
      detail,
      tournamentId,
      module,
      at: new Date().toISOString(),
    })
  }
  const namesToPlayerIds = (names = []) =>
    names
      .map((name) =>
        normalizedPlayerMap.get(
          (name || '')
            .toString()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ''),
        ),
      )
      .filter(Boolean)
      .map((player) => player.id)
  const preSeedFlowData = () => {
    ;(flowSeedTeamSelections || []).forEach((row) => {
      const payload = {
        contestId: row.contestId,
        matchId: row.matchId,
        userId: row.userId,
        playingXi: namesToPlayerIds(row.pickNames || []).slice(0, 11),
        backups: namesToPlayerIds(row.backupNames || []).slice(0, 6),
        updatedAt: new Date().toISOString(),
      }
      if (payload.playingXi.length !== 11) return
      mockTeamSelections.set(selectionKey(payload), payload)
    })
    ;(flowSeedMatchScores || []).forEach((row) => {
      const exists = matchScores.some(
        (item) =>
          Number(item?.id) === Number(row.id) ||
          ((item?.tournamentId || '').toString() ===
            (row.tournamentId || '').toString() &&
            (item?.matchId || '').toString() === (row.matchId || '').toString() &&
            item?.source === 'seed'),
      )
      if (exists) return
      matchScores.push({
        ...row,
        active: row.active !== false,
        playerStats: Array.isArray(row.playerStats) ? row.playerStats : [],
      })
    })
  }
  preSeedFlowData()
  const hasSeededTemplateUser = (userId = '') => {
    const normalized = userId.toString().trim()
    if (!normalized) return false
    const seededCoreUsers = new Set([
      'master',
      'admin',
      'player',
      'contestmgr',
      'sreecharan',
      'rahulxi',
      'kiran11',
      'acestriker',
    ])
    if (seededCoreUsers.has(normalized.toLowerCase())) return true
    if (/^player\d+$/i.test(normalized)) return true
    if (Object.hasOwn(sampleUserPicks, normalized)) return true
    const normalizedKey = normalized.toLowerCase()
    return Object.keys(sampleUserPicks).some((key) => key.toLowerCase() === normalizedKey)
  }
  const resolveMockSelection = ({
    contestId,
    matchId,
    userId,
    seedFromDefaultHasTeam = false,
  }) => {
    const key = selectionKey({ contestId, matchId, userId })
    if (mockTeamSelections.has(key)) {
      return mockTeamSelections.get(key)
    }
    const flowSeed = (flowSeedTeamSelections || []).find(
      (item) =>
        (item?.contestId || '').toString() === (contestId || '').toString() &&
        (item?.matchId || '').toString() === (matchId || '').toString() &&
        (item?.userId || '').toString().toLowerCase() ===
          (userId || '').toString().toLowerCase(),
    )
    if (flowSeed) {
      const seeded = {
        contestId,
        matchId,
        userId,
        playingXi: namesToPlayerIds(flowSeed.pickNames || []).slice(0, 11),
        backups: namesToPlayerIds(flowSeed.backupNames || []).slice(0, 6),
        updatedAt: new Date().toISOString(),
      }
      if (seeded.playingXi.length === 11) {
        mockTeamSelections.set(key, seeded)
        return seeded
      }
    }

    if (!seedFromDefaultHasTeam) return null
    const targetContest = mockContests.find(
      (contest) => (contest?.id || '').toString() === (contestId || '').toString(),
    )
    // Custom/admin-created contests should always start with no team picks.
    if (targetContest?.isCustom) return null
    if (!hasSeededTemplateUser(userId)) return null
    const defaultMatch = buildMatches(
      100,
      targetContest?.tournamentId || 't20wc-2026',
    ).find((item) => item.id === matchId)
    if (!defaultMatch?.hasTeam) return null
    const normalizedMatchStatus = normalizeMatchStatus(defaultMatch.status)
    const canBackfillLegacyCompleted =
      normalizedMatchStatus === 'completed' || normalizedMatchStatus === 'inprogress'
    if (!autoSeedTeams && !canBackfillLegacyCompleted) return null

    const matchRosters = getMatchRosters(defaultMatch)
    const defaultPlayingXi = [
      ...matchRosters.teamA.slice(0, 6),
      ...matchRosters.teamB.slice(0, 5),
    ].map((player) => player.id)
    const fallbackPlayingXi = namesToPlayerIds(getFallbackPickNames(userId)).slice(0, 11)
    const playingXi = (
      defaultPlayingXi.length ? defaultPlayingXi : fallbackPlayingXi
    ).slice(0, 11)
    if (!playingXi.length) return null
    const seeded = {
      contestId,
      matchId,
      userId,
      playingXi,
      backups: [],
      updatedAt: new Date().toISOString(),
    }
    mockTeamSelections.set(key, seeded)
    return seeded
  }

  const persistState = () => {
    if (!seedProviderEnabled) return
    persistSeedState()
  }
  const getMockPageLoadData = (req, res) => {
    return res.json({
      ...dashboardMockData,
      players: allKnownPlayers,
      playerStats,
      prettyTournament,
    })
  }

  const getPlayerPointsIndex = (tournamentId = '') =>
    buildPlayerPointsIndex({
      tournamentId: tournamentId || '',
      matchScores,
      scoringRules,
      dashboardRuleTemplate: dashboardMockData.pointsRuleTemplate,
      players: allKnownPlayers,
    })
  const getTournamentPlayerStatsIndex = (tournamentId = '') => {
    const ruleSet = getRuleSetForTournament({
      tournamentId: tournamentId || '',
      scoringRules,
      dashboardRuleTemplate: dashboardMockData.pointsRuleTemplate,
    })
    const index = {}
    matchScores
      .filter((score) => {
        if (!score?.active) return false
        if (!tournamentId) return true
        return score.tournamentId === tournamentId
      })
      .forEach((score) => {
        const matchId = score?.matchId?.toString() || ''
        const rows = normalizePlayerStatRows(score?.playerStats || [], allKnownPlayers)
        rows.forEach((row) => {
          const points = calculateFantasyPoints(row, ruleSet)
          if (!index[row.playerId]) {
            index[row.playerId] = {
              playerId: row.playerId,
              playerName: row.playerName,
              team: row.team,
              runs: 0,
              wickets: 0,
              catches: 0,
              fours: 0,
              sixes: 0,
              totalPoints: 0,
              matches: 0,
              byMatch: {},
            }
          }
          const target = index[row.playerId]
          target.runs += Number(row.runs || 0)
          target.wickets += Number(row.wickets || 0)
          target.catches += Number(row.catches || 0)
          target.fours += Number(row.fours || 0)
          target.sixes += Number(row.sixes || 0)
          target.totalPoints += Number(points || 0)
          if (!target.byMatch[matchId]) {
            target.byMatch[matchId] = {
              points: 0,
              runs: 0,
              wickets: 0,
              catches: 0,
              fours: 0,
              sixes: 0,
            }
            target.matches += 1
          }
          const matchBucket = target.byMatch[matchId]
          matchBucket.points += Number(points || 0)
          matchBucket.runs += Number(row.runs || 0)
          matchBucket.wickets += Number(row.wickets || 0)
          matchBucket.catches += Number(row.catches || 0)
          matchBucket.fours += Number(row.fours || 0)
          matchBucket.sixes += Number(row.sixes || 0)
        })
      })
    return index
  }
  const getMatchPlayerPointsByName = ({ tournamentId = '', matchId = '' } = {}) => {
    if (!matchId) return {}
    const aggregates = getTournamentPlayerStatsIndex(tournamentId)
    const pointsByName = {}
    Object.values(aggregates).forEach((row) => {
      const matchRow = row.byMatch?.[matchId]
      if (!matchRow) return
      const key = normalizeUserKey(row.playerName)
      pointsByName[key] = Number(matchRow.points || 0)
    })
    return pointsByName
  }

  const normalizeUserKey = (value = '') =>
    value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  const resolveActorUser = (identifier) => {
    if (identifier == null) return null
    const raw = identifier.toString().trim()
    if (!raw) return null
    const lower = raw.toLowerCase()
    return (
      users.find(
        (user) =>
          String(user.id) === raw ||
          user.userId?.toLowerCase() === lower ||
          user.gameName?.toLowerCase() === lower ||
          user.email?.toLowerCase() === lower,
      ) || null
    )
  }
  const canWriteScoresForContest = (actor, contestId) => {
    if (!actor) return false
    if (['admin', 'master_admin'].includes(actor.role)) return true
    return (
      actor.role === 'contest_manager' &&
      Boolean(actor.contestManagerContestId) &&
      actor.contestManagerContestId === contestId
    )
  }
  const normalizeMatchStatus = (value = '') =>
    value.toString().trim().toLowerCase().replace(/\s+/g, '')
  const normalizeLineupName = (value = '') =>
    value
      .toString()
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  const normalizeLineupNameKey = (value = '') =>
    normalizeLineupName(value).replace(/\s+/g, ' ').toLowerCase()
  const dedupeNames = (names = []) =>
    (Array.isArray(names) ? names : []).reduce(
      (acc, item) => {
        const normalizedName = normalizeLineupName(item)
        if (!normalizedName) return acc
        const key = normalizeLineupNameKey(normalizedName)
        if (acc.seen.has(key)) return acc
        acc.seen.add(key)
        acc.values.push(normalizedName)
        return acc
      },
      { seen: new Set(), values: [] },
    ).values
  const validateLineupTeamPayload = ({
    teamCode,
    payload,
    fallbackSquad = [],
    strictSquad = false,
  }) => {
    if (!payload || typeof payload !== 'object') {
      return { ok: false, message: `lineups.${teamCode} is required` }
    }
    const providedSquad = Array.isArray(payload.squad) ? payload.squad : []
    const normalizedSquad = dedupeNames(
      providedSquad.length ? providedSquad : fallbackSquad,
    )
    const submittedPlayingXI = Array.isArray(payload.playingXI) ? payload.playingXI : []
    const playingXI = dedupeNames(payload.playingXI)
    const bench = dedupeNames(payload.bench)
    const findDuplicateLineupNames = (values = []) => {
      const firstSeenByKey = new Map()
      const duplicates = []
      const seenDuplicateKeys = new Set()

      for (const item of Array.isArray(values) ? values : []) {
        const normalizedName = normalizeLineupName(item)
        if (!normalizedName) continue
        const key = normalizeLineupNameKey(normalizedName)
        if (!firstSeenByKey.has(key)) {
          firstSeenByKey.set(key, normalizedName)
          continue
        }
        if (seenDuplicateKeys.has(key)) continue
        seenDuplicateKeys.add(key)
        duplicates.push(firstSeenByKey.get(key))
      }

      return duplicates
    }
    if (strictSquad && !providedSquad.length) {
      return {
        ok: false,
        message: `lineups.${teamCode}.squad is required for manual updates`,
      }
    }
    if (playingXI.length < 11 || playingXI.length > 12) {
      const duplicates = findDuplicateLineupNames(submittedPlayingXI)
      const submittedNames = (Array.isArray(submittedPlayingXI) ? submittedPlayingXI : [])
        .map((name) => normalizeLineupName(name))
        .filter(Boolean)
      const duplicateText = duplicates.length
        ? ` Duplicates: ${duplicates.join(', ')}.`
        : ''
      const submittedText = submittedNames.length
        ? ` Submitted players: ${submittedNames.join(', ')}.`
        : ''
      return {
        ok: false,
        message: `lineups.${teamCode}.playingXI must contain 11 or 12 unique players. Received ${playingXI.length} unique players from ${submittedPlayingXI.length} entries.${duplicateText}${submittedText} Next steps: check the full submitted list above, remove duplicates if any, and make sure exactly 11 or 12 valid player names are listed.`,
      }
    }
    const squadKeySet = new Set(
      normalizedSquad.map((name) => normalizeLineupNameKey(name)),
    )
    const xiOutside = playingXI.filter(
      (name) => !squadKeySet.has(normalizeLineupNameKey(name)),
    )
    if (xiOutside.length) {
      return {
        ok: false,
        message: `lineups.${teamCode}.playingXI player "${xiOutside[0]}" is not in squad`,
      }
    }
    if (normalizedSquad.length < 11) {
      return {
        ok: false,
        message: `lineups.${teamCode}.squad must contain at least 11 unique players`,
      }
    }
    const captain =
      typeof payload.captain === 'string' ? normalizeLineupName(payload.captain) : ''
    const viceCaptain =
      typeof payload.viceCaptain === 'string'
        ? normalizeLineupName(payload.viceCaptain)
        : ''
    const playingXIKeySet = new Set(playingXI.map((name) => normalizeLineupNameKey(name)))
    if (captain && !playingXIKeySet.has(normalizeLineupNameKey(captain))) {
      return {
        ok: false,
        message: `lineups.${teamCode}.captain must be part of playingXI`,
      }
    }
    if (viceCaptain && !playingXIKeySet.has(normalizeLineupNameKey(viceCaptain))) {
      return {
        ok: false,
        message: `lineups.${teamCode}.viceCaptain must be part of playingXI`,
      }
    }
    if (
      captain &&
      viceCaptain &&
      normalizeLineupNameKey(captain) === normalizeLineupNameKey(viceCaptain)
    ) {
      return {
        ok: false,
        message: `lineups.${teamCode}.captain and viceCaptain cannot be the same`,
      }
    }
    const normalizedBench = bench.filter(
      (name) => !playingXIKeySet.has(normalizeLineupNameKey(name)),
    )
    return {
      ok: true,
      value: {
        squad: normalizedSquad,
        playingXI,
        bench: normalizedBench,
        captain: captain || null,
        viceCaptain: viceCaptain || null,
      },
    }
  }

  const resolveContestUserPickNames = (userId) => {
    if (sampleUserPicks[userId]) return sampleUserPicks[userId]
    const normalizedTarget = normalizeUserKey(userId)
    const matchedKey = Object.keys(sampleUserPicks).find(
      (key) => normalizeUserKey(key) === normalizedTarget,
    )
    if (!matchedKey) return []
    return sampleUserPicks[matchedKey] || []
  }

  const getContestById = (contestId = '') =>
    mockContests.find(
      (contest) => (contest?.id || '').toString() === (contestId || '').toString(),
    ) || null

  const isFixedRosterContest = (contest) =>
    (contest?.mode || '').toString().trim().toLowerCase() === 'fixed_roster'

  const getFixedRosterEntries = (contest) =>
    Array.isArray(contest?.fixedParticipants) ? contest.fixedParticipants : []

  const getFixedRosterEntry = ({ contest, userId = '' }) => {
    const targetKey = normalizeUserKey(userId)
    if (!targetKey) return null
    return (
      getFixedRosterEntries(contest).find((entry) => {
        const entryUserId = normalizeUserKey(entry?.userId || '')
        const entryName = normalizeUserKey(entry?.name || '')
        return entryUserId === targetKey || entryName === targetKey
      }) || null
    )
  }

  const getFixedRosterNames = ({ contest, userId = '', matchId = '' }) => {
    const entry = getFixedRosterEntry({ contest, userId })
    const fullRoster = Array.isArray(entry?.roster) ? entry.roster.filter(Boolean) : []
    if (!matchId) {
      return { roster: fullRoster, rest: [] }
    }
    const activeMatch = buildMatches(100, contest?.tournamentId || 't20wc-2026').find(
      (match) => match.id === matchId,
    )
    if (!activeMatch) {
      return { roster: fullRoster, rest: [] }
    }
    const matchTeams = new Set([activeMatch.home, activeMatch.away])
    const roster = fullRoster.filter((name) => {
      const player = normalizedPlayerMap.get(normalizePlayerName(name))
      return player ? matchTeams.has(player.team) : false
    })
    const matchRosterKeys = new Set(roster.map((name) => normalizeUserKey(name)))
    const rest = fullRoster.filter((name) => !matchRosterKeys.has(normalizeUserKey(name)))
    return { roster, rest }
  }

  const buildContestUserMatchRows = ({ contest, userId, compareUserId }) => {
    const ruleSet = getRuleSetForTournament({
      tournamentId: contest.tournamentId,
      scoringRules,
      dashboardRuleTemplate: dashboardMockData.pointsRuleTemplate,
    })
    const scopedMatchIds = Array.isArray(contest?.matchIds)
      ? new Set(contest.matchIds.map((id) => id.toString()))
      : null
    const contestMatches = buildMatches(100, contest.tournamentId).filter((match) =>
      scopedMatchIds && scopedMatchIds.size ? scopedMatchIds.has(match.id) : true,
    )
    const resolveMatchUserSelection = ({ targetUserId, match }) => {
      if (isFixedRosterContest(contest)) {
        return {
          pickNames: getFixedRosterNames({
            contest,
            userId: targetUserId,
            matchId: match.id,
          }).roster,
          multiplierMap: new Map(),
        }
      }
      const selection = resolveMockSelection({
        contestId: contest.id,
        matchId: match.id,
        userId: targetUserId,
        seedFromDefaultHasTeam: true,
      })
      if (!selection?.playingXi?.length) {
        return { pickNames: [], multiplierMap: new Map() }
      }
      const savedLineup =
        mockMatchLineups.get(
          lineupKey({
            tournamentId: contest?.tournamentId || '',
            matchId: match.id,
          }),
        ) || null
      const activeNameSet = new Set([
        ...(savedLineup?.lineups?.[match.home]?.playingXI || []).map((name) =>
          normalizeUserKey(name),
        ),
        ...(savedLineup?.lineups?.[match.away]?.playingXI || []).map((name) =>
          normalizeUserKey(name),
        ),
      ])
      const activePlayerIds = activeNameSet.size
        ? [...idToPlayerName.entries()]
            .filter(([, name]) => activeNameSet.has(normalizeUserKey(name)))
            .map(([id]) => id)
        : []
      const resolved = resolveEffectiveSelection({
        playingXi: selection.playingXi,
        backups: selection.backups,
        activePlayerIds,
        captainId: selection.captainId,
        viceCaptainId: selection.viceCaptainId,
      })
      const multipliers = new Map()
      if (resolved.captainApplies && selection?.captainId) {
        const captainName = idToPlayerName.get(selection.captainId)
        if (captainName) multipliers.set(normalizeUserKey(captainName), 2)
      }
      if (resolved.viceCaptainApplies && selection?.viceCaptainId) {
        const viceName = idToPlayerName.get(selection.viceCaptainId)
        if (viceName) multipliers.set(normalizeUserKey(viceName), 1.5)
      }
      return {
        pickNames: resolved.effectivePlayerIds
          .map((id) => idToPlayerName.get(id))
          .filter(Boolean),
        multiplierMap: multipliers,
      }
    }
    const rows = contestMatches.map((match) => {
      const userSelection = resolveMatchUserSelection({ targetUserId: userId, match })
      const compareSelection = resolveMatchUserSelection({
        targetUserId: compareUserId,
        match,
      })
      const normalizedUserPicks = new Set(
        userSelection.pickNames.map((name) => normalizeUserKey(name)),
      )
      const normalizedComparePicks = new Set(
        compareSelection.pickNames.map((name) => normalizeUserKey(name)),
      )
      const score = [...matchScores]
        .filter((item) => item?.active !== false)
        .reverse()
        .find(
          (item) =>
            item?.tournamentId === contest.tournamentId && item?.matchId === match.id,
        )
      const hasUploadedScore = Boolean(score)
      const normalizedRows = normalizePlayerStatRows(
        score?.playerStats || [],
        allKnownPlayers,
      )
      const uploadedPointsByPlayerName = normalizedRows.reduce((acc, statRow) => {
        const nameKey = normalizeUserKey(statRow.playerName)
        const points = calculateFantasyPoints(statRow, ruleSet)
        acc[nameKey] = Number(acc[nameKey] || 0) + points
        return acc
      }, {})
      const fallbackPointsByPlayerName =
        !hasUploadedScore && normalizeMatchStatus(match.status) !== 'notstarted'
          ? [...getMatchRosters(match).teamA, ...getMatchRosters(match).teamB].reduce(
              (acc, player) => {
                const nameKey = normalizeUserKey(player.name)
                acc[nameKey] =
                  12 + ((nameHash(player.name) + Number(match.matchNo || 1) * 17) % 79)
                return acc
              },
              {},
            )
          : {}
      const pointsByPlayerName = hasUploadedScore
        ? uploadedPointsByPlayerName
        : fallbackPointsByPlayerName
      const userMultipliers = isFixedRosterContest(contest)
        ? new Map()
        : userSelection.multiplierMap
      const compareMultipliers = isFixedRosterContest(contest)
        ? new Map()
        : compareSelection.multiplierMap
      const userPoints = Object.entries(pointsByPlayerName).reduce(
        (sum, [nameKey, points]) => {
          if (!normalizedUserPicks.has(nameKey)) return sum
          return sum + Number(points || 0) * Number(userMultipliers.get(nameKey) || 1)
        },
        0,
      )
      const comparePoints = Object.entries(pointsByPlayerName).reduce(
        (sum, [nameKey, points]) => {
          if (!normalizedComparePicks.has(nameKey)) return sum
          return sum + Number(points || 0) * Number(compareMultipliers.get(nameKey) || 1)
        },
        0,
      )
      return {
        matchId: match.id,
        matchNo: match.matchNo,
        matchName: `${match.home} vs ${match.away}`,
        date: match.date,
        status: match.status,
        userPoints,
        comparePoints,
        delta: userPoints - comparePoints,
      }
    })
    return rows
  }

  const buildContestMatchPointsIndex = ({ contest, matchId }) => {
    const ruleSet = getRuleSetForTournament({
      tournamentId: contest.tournamentId,
      scoringRules,
      dashboardRuleTemplate: dashboardMockData.pointsRuleTemplate,
    })
    const score = [...matchScores]
      .filter((item) => item?.active !== false)
      .reverse()
      .find(
        (item) =>
          item?.tournamentId === contest.tournamentId && item?.matchId === matchId,
      )
    const normalizedRows = normalizePlayerStatRows(
      score?.playerStats || [],
      allKnownPlayers,
    )
    return normalizedRows.reduce((acc, statRow) => {
      const nameKey = normalizeUserKey(statRow.playerName)
      const points = calculateFantasyPoints(statRow, ruleSet)
      acc[nameKey] = Number(acc[nameKey] || 0) + points
      return acc
    }, {})
  }

  const resolveMatchUserPickNames = ({ contestId, matchId, userId }) => {
    const contest = getContestById(contestId)
    if (isFixedRosterContest(contest)) {
      return getFixedRosterNames({ contest, userId, matchId }).roster
    }
    const selection = resolveMockSelection({
      contestId,
      matchId,
      userId,
      seedFromDefaultHasTeam: true,
    })
    if (!selection?.playingXi?.length) return []
    const match = buildMatches(100, contest?.tournamentId || 't20wc-2026').find(
      (item) => String(item.id) === String(matchId),
    )
    if (!match) {
      return selection.playingXi.map((id) => idToPlayerName.get(id)).filter(Boolean)
    }
    const savedLineup =
      mockMatchLineups.get(
        lineupKey({
          tournamentId: contest?.tournamentId || '',
          matchId,
        }),
      ) || null
    const activeNameSet = new Set([
      ...(savedLineup?.lineups?.[match.home]?.playingXI || []).map((name) =>
        normalizeUserKey(name),
      ),
      ...(savedLineup?.lineups?.[match.away]?.playingXI || []).map((name) =>
        normalizeUserKey(name),
      ),
    ])
    const activePlayerIds = activeNameSet.size
      ? [...idToPlayerName.entries()]
          .filter(([, name]) => activeNameSet.has(normalizeUserKey(name)))
          .map(([id]) => id)
      : []
    const resolved = resolveEffectiveSelection({
      playingXi: selection.playingXi,
      backups: selection.backups,
      activePlayerIds,
      captainId: selection.captainId,
      viceCaptainId: selection.viceCaptainId,
    })
    return resolved.effectivePlayerIds.map((id) => idToPlayerName.get(id)).filter(Boolean)
  }

  const getContestUserPool = ({ contest, viewerUserId = '' }) => {
    if (isFixedRosterContest(contest)) {
      return getFixedRosterEntries(contest).map((entry, index) => ({
        id: `${entry.userId}-${index + 1}`,
        userId: entry.userId,
        name: entry.name || entry.userId,
      }))
    }
    const targetCount = Math.max(1, Number(contest?.teams || 0))
    ensureCoreContestUsers()
    ensureRegisteredUserPool(targetCount)
    const joinedUsersForContest = Object.entries(contestJoins)
      .filter(([, contestIds]) =>
        Array.isArray(contestIds)
          ? contestIds.map((id) => id.toString()).includes((contest?.id || '').toString())
          : false,
      )
      .map(([userId]) => userId)
    const selectionUsersForContest = Array.from(mockTeamSelections.values())
      .filter(
        (selection) =>
          (selection?.contestId || '').toString() === (contest?.id || '').toString(),
      )
      .map((selection) => (selection?.userId || '').toString())
      .filter(Boolean)
    const explicitUserIds = Array.from(
      new Set([...joinedUsersForContest, ...selectionUsersForContest]),
    )
    const knownUsers = users
      .filter((user) => Boolean(user?.gameName))
      .map((user) => ({
        userId: user.gameName,
        name: user.gameName,
      }))
    const seededUserMap = new Map()
    if (explicitUserIds.length) {
      explicitUserIds.forEach((joinedUserId) => {
        const normalized = normalizeUserKey(joinedUserId)
        const found =
          knownUsers.find((user) => normalizeUserKey(user.userId) === normalized) || null
        const actor = found ? null : resolveActorUser(joinedUserId)
        if (found) {
          seededUserMap.set(joinedUserId, found)
          return
        }
        if (actor?.gameName) {
          seededUserMap.set(joinedUserId, {
            userId: actor.gameName,
            name: actor.gameName,
          })
        }
      })
    } else {
      knownUsers.forEach((user) => seededUserMap.set(user.userId, user))
    }
    if (
      !joinedUsersForContest.length &&
      viewerUserId &&
      !seededUserMap.has(viewerUserId)
    ) {
      const actor = resolveActorUser(viewerUserId)
      if (actor?.gameName) {
        seededUserMap.set(viewerUserId, {
          userId: actor.gameName,
          name: actor.gameName,
        })
      }
    }
    const seededUsers = Array.from(seededUserMap.values())
    const prioritizedUsers = [...seededUsers]
    const liftUserToFront = (userId) => {
      if (!userId) return
      const index = prioritizedUsers.findIndex((user) => user.userId === userId)
      if (index <= 0) return
      const [picked] = prioritizedUsers.splice(index, 1)
      prioritizedUsers.unshift(picked)
    }
    liftUserToFront('master')
    liftUserToFront('admin')
    liftUserToFront('player')
    liftUserToFront('contestmgr')
    const e2eBotIds = prioritizedUsers
      .filter((user) => user.userId.startsWith('mocke2ebot-'))
      .map((user) => user.userId)
    e2eBotIds.reverse().forEach((userId) => liftUserToFront(userId))
    if (viewerUserId) liftUserToFront(viewerUserId)
    const scopedUsers = explicitUserIds.length
      ? prioritizedUsers
      : prioritizedUsers.slice(0, targetCount)
    return scopedUsers.map((seededUser, index) => ({
      id: `${seededUser.userId}-${index + 1}`,
      userId: seededUser.userId,
      name: seededUser.name,
    }))
  }

  const buildContestLeaderboardRowsFromUserPool = ({ contest, usersPool }) =>
    usersPool
      .map((user) => {
        const rows = buildContestUserMatchRows({
          contest,
          userId: user.userId,
          compareUserId: '',
        })
        const computedPoints = rows.reduce(
          (sum, row) => sum + Number(row.userPoints || 0),
          0,
        )
        return {
          id: `${user.userId}-${contest.id}`,
          userId: user.userId,
          name: user.name,
          points: computedPoints,
        }
      })
      .sort((a, b) => {
        const scoreDelta = Number(b.points || 0) - Number(a.points || 0)
        if (scoreDelta !== 0) return scoreDelta
        return a.name.localeCompare(b.name)
      })

  return {
    users,
    getNextUserId,
    getMockPageLoadData,
    tournamentCatalog,
    enabledTournamentIds,
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
    resolveContestUserPickNames,
    isFixedRosterContest,
    getFixedRosterNames,
    buildContestMatchPointsIndex,
    resolveMatchUserPickNames,
    nameHash,
    previewXI,
    buildContestLeaderboardRowsFromUserPool,
    buildContestUserMatchRows,
    prettyTournament,
    allKnownPlayers,
    dashboardMockData,
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
  }
}

export { createMockProviderContext, resetMockProviderContexts }
