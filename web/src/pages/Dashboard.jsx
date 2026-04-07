import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ApiFailureTile from '../components/ui/ApiFailureTile.jsx'
import {
  fetchAdminMatchScores,
  fetchContests,
  fetchManualScoreContext,
  fetchTeamPool,
  fetchTournamentMatches,
  fetchDashboardPageLoadData,
  saveMatchScores,
  saveScoringRules,
  resetManualMatchScores,
  replaceAdminMatchBackups,
  upsertMatchLineups,
  upsertManualMatchScores,
} from '../lib/api.js'
import AdminManagerPanel from './dashboard/AdminManagerPanel.jsx'
import AuditLogsPanel from './dashboard/AuditLogsPanel.jsx'
import CreateTournamentPanel from './dashboard/CreateTournamentPanel.jsx'
import JoinedPanel from './dashboard/JoinedPanel.jsx'
import PointsPanel from './dashboard/PointsPanel.jsx'
import PendingApprovalsPanel from './dashboard/PendingApprovalsPanel.jsx'
import PlayerManagerPanel from './dashboard/PlayerManagerPanel.jsx'
import SquadManagerPanel from './dashboard/SquadManagerPanel.jsx'
import TournamentManagerPanel from './dashboard/TournamentManagerPanel.jsx'
import UserManagerPanel from './dashboard/UserManagerPanel.jsx'
import UploadPanel from './dashboard/UploadPanel.jsx'
import {
  adminMenuItems,
  masterMenuItems,
  regularMenuItems,
  sectionTitles,
} from './dashboard/constants.js'
import { getStoredUser } from '../lib/auth.js'
import {
  cloneDefaultPointsRules,
  normalizePointsRuleTemplate,
} from '../lib/defaultPointsRules.js'
import { useScoreManagerCache } from '../contexts/ScoreManagerCacheContext.jsx'

const defaultPointsRules = cloneDefaultPointsRules()

const buildFallbackBootstrap = () => ({
  tournaments: [],
  joinedContests: [],
  pointsRuleTemplate: defaultPointsRules,
  adminManager: [],
  masterConsole: [],
  auditLogs: [],
})

const buildDefaultManualStatsRow = () => ({
  runs: 0,
  ballsFaced: 0,
  fours: 0,
  sixes: 0,
  overs: 0,
  runsConceded: 0,
  wickets: 0,
  maidens: 0,
  noBalls: 0,
  wides: 0,
  catches: 0,
  stumpings: 0,
  runoutDirect: 0,
  runoutIndirect: 0,
  dismissed: false,
})

const normalizeManualPlayerKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()

const normalizeLooseKey = (value) =>
  normalizeManualPlayerKey(value).replace(/[^a-z0-9]/g, '')

const buildManualStatsState = (players = [], savedRows = []) => {
  const next = {}
  const playerIdsByName = new Map(
    (players || []).map((player) => [normalizeManualPlayerKey(player.name), player.id]),
  )

  ;(players || []).forEach((player) => {
    next[player.id] = buildDefaultManualStatsRow()
  })
  ;(savedRows || []).forEach((row) => {
    const targetId =
      (row?.playerId != null && next[row.playerId] ? row.playerId : null) ||
      playerIdsByName.get(normalizeManualPlayerKey(row?.playerName))
    if (!targetId) return
    const normalizedOvers =
      row?.overs != null && row?.overs !== '' ? row.overs : row?.oversBowled
    next[targetId] = {
      ...buildDefaultManualStatsRow(),
      ...next[targetId],
      ...row,
      overs: Number(normalizedOvers || 0),
      dismissed: Boolean(row?.dismissed),
    }
  })

  return next
}

function Dashboard({ defaultPanel = 'joined' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const requestedPanel = (searchParams.get('panel') || '').trim()
  const [activePanel, setActivePanel] = useState(defaultPanel)
  const [selectedTournament, setSelectedTournament] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [uploadTab, setUploadTab] = useState('manual')
  const [manualContestId, setManualContestId] = useState('')
  const [manualTeamPool, setManualTeamPool] = useState({
    teamAName: 'Team A',
    teamBName: 'Team B',
    teamAPlayers: [],
    teamBPlayers: [],
    teamALineup: null,
    teamBLineup: null,
  })
  const [manualPlayingXi, setManualPlayingXi] = useState({
    teamA: [],
    teamB: [],
  })
  const [manualPlayerStats, setManualPlayerStats] = useState({})
  const [isLoadingManualPool, setIsLoadingManualPool] = useState(false)
  const [manualScoreContext, setManualScoreContext] = useState({
    tournaments: [],
    matches: [],
  })
  const [manualTournamentId, setManualTournamentId] = useState('')
  const [manualMatchId, setManualMatchId] = useState('')
  const [uploadPayloadText, setUploadPayloadText] = useState('')
  const [scoreJsonUnmatchedDetails, setScoreJsonUnmatchedDetails] = useState([])
  const [isGeneratedScoreJsonOpen, setIsGeneratedScoreJsonOpen] = useState(false)
  const [generatedScoreJsonText, setGeneratedScoreJsonText] = useState('')
  const [lineupPayloadText, setLineupPayloadText] = useState('')
  const [isGeneratedLineupJsonOpen, setIsGeneratedLineupJsonOpen] = useState(false)
  const [generatedLineupJsonText, setGeneratedLineupJsonText] = useState('')
  const [isLineupPreviewOpen, setIsLineupPreviewOpen] = useState(false)
  const [lineupPreviewPayload, setLineupPreviewPayload] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingRules, setIsSavingRules] = useState(false)
  const [isRulesEditEnabled, setIsRulesEditEnabled] = useState(false)
  const [isSavingScores, setIsSavingScores] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [pageLoadData, setPageLoadData] = useState(buildFallbackBootstrap)
  const [pointsRules, setPointsRules] = useState(defaultPointsRules)
  const { cache: scoreManagerCache, setCache: setScoreManagerCache } =
    useScoreManagerCache()
  const allContests = scoreManagerCache?.allContests || []
  const currentUser = getStoredUser()
  const currentUserId =
    currentUser?.userId || currentUser?.gameName || currentUser?.email || ''
  const mobilePanelValue =
    activePanel === '__all-pages__' || activePanel === '__all-apis__'
      ? defaultPanel
      : activePanel
  const panelAliases = {
    admin: 'userManager',
    createTournament: 'tournamentManager',
    approvals: 'userManager',
    upload: 'scoreManager',
  }
  const panelsWithGlobalSaveNotice = new Set([
    'points',
    'playingXiManager',
    'scoreManager',
  ])

  const selectPanel = (nextPanel) => {
    if (nextPanel === '__all-pages__') {
      navigate('/all-pages')
      return
    }
    if (nextPanel === '__all-apis__') {
      navigate('/all-apis')
      return
    }
    const nextSearch = new URLSearchParams(location.search)
    nextSearch.set('panel', nextPanel)
    navigate(
      {
        pathname: location.pathname,
        search: `?${nextSearch.toString()}`,
      },
      { replace: false },
    )
  }

  const getMatchCacheKey = (tournamentId, matchId) =>
    `${String(tournamentId || '')}::${String(matchId || '')}`

  const applyManualStatsFromSavedScore = ({
    teamAPlayers = [],
    teamBPlayers = [],
    savedScore = null,
  }) => {
    setManualPlayerStats(
      buildManualStatsState(
        [...teamAPlayers, ...teamBPlayers],
        savedScore?.playerStats || [],
      ),
    )
  }

  const cacheSavedScoreForMatch = ({ tournamentId, matchId, savedScore }) => {
    const cacheKey = getMatchCacheKey(tournamentId, matchId)
    setScoreManagerCache((prev) => ({
      ...prev,
      savedScoresByMatch: {
        ...(prev.savedScoresByMatch || {}),
        [cacheKey]: savedScore,
      },
    }))
  }

  const refreshManualStatsState = async ({
    tournamentId,
    matchId,
    teamAPlayers = [],
    teamBPlayers = [],
    forceRefresh = false,
  }) => {
    const cacheKey = getMatchCacheKey(tournamentId, matchId)
    const savedScoresByMatch = scoreManagerCache?.savedScoresByMatch || {}
    const hasCachedScore = Object.prototype.hasOwnProperty.call(
      savedScoresByMatch,
      cacheKey,
    )
    if (!forceRefresh && hasCachedScore) {
      applyManualStatsFromSavedScore({
        teamAPlayers,
        teamBPlayers,
        savedScore: savedScoresByMatch[cacheKey],
      })
      return
    }

    try {
      const savedScore = await fetchAdminMatchScores({ tournamentId, matchId })
      cacheSavedScoreForMatch({ tournamentId, matchId, savedScore: savedScore || null })
      applyManualStatsFromSavedScore({ teamAPlayers, teamBPlayers, savedScore })
    } catch {
      applyManualStatsFromSavedScore({ teamAPlayers, teamBPlayers, savedScore: null })
    }
  }

  useEffect(() => {
    const nextPanel = requestedPanel || defaultPanel
    setActivePanel((prev) => (prev === nextPanel ? prev : nextPanel))
  }, [defaultPanel, requestedPanel])

  useEffect(() => {
    const aliasedPanel = panelAliases[activePanel]
    if (aliasedPanel) {
      selectPanel(aliasedPanel)
    }
  }, [activePanel])

  useEffect(() => {
    // Clear shared banner state when switching dashboard panels.
    setErrorText('')
    setSaveNotice('')
    setScoreJsonUnmatchedDetails([])
  }, [activePanel])

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const [data, allContestsRes, joinedContestsRes] = await Promise.all([
          fetchDashboardPageLoadData(),
          fetchContests({ userId: currentUserId }),
          fetchContests({ userId: currentUserId, joined: true }),
        ])
        if (!active) return
        const joinedFromEndpoint = Array.isArray(joinedContestsRes)
          ? joinedContestsRes
          : []
        const joinedFromPageLoad = Array.isArray(data?.joinedContests)
          ? data.joinedContests
          : []
        const joinedPageLoadById = new Map(
          joinedFromPageLoad.map((contest) => [String(contest.id), contest]),
        )
        const mergedJoinedFromEndpoint = joinedFromEndpoint.map((contest) => ({
          ...joinedPageLoadById.get(String(contest.id)),
          ...contest,
        }))
        const toJoinedDashboardContests = (rows = []) =>
          (rows || []).filter(
            (contest) =>
              (contest?.mode || '').toString().toLowerCase() !== 'fixed_roster',
          )
        const joinedFromAll = (allContestsRes || []).filter(
          (contest) => contest?.joined || contest?.hasTeam,
        )
        setPageLoadData({
          tournaments: data?.tournaments || [],
          joinedContests:
            mergedJoinedFromEndpoint.length > 0
              ? toJoinedDashboardContests(mergedJoinedFromEndpoint)
              : toJoinedDashboardContests(joinedFromAll),
          pointsRuleTemplate: normalizePointsRuleTemplate(data?.pointsRuleTemplate),
          adminManager: data?.adminManager || [],
          masterConsole: data?.masterConsole || [],
          auditLogs: data?.auditLogs || [],
        })
        setPointsRules(normalizePointsRuleTemplate(data?.pointsRuleTemplate))
        setScoreManagerCache((prev) => ({
          ...prev,
          allContests: allContestsRes || [],
        }))
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load dashboard data')
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    load()
    return () => {
      active = false
    }
  }, [currentUserId])

  useEffect(() => {
    if (
      Array.isArray(scoreManagerCache?.tournaments) &&
      scoreManagerCache.tournaments.length
    ) {
      setManualScoreContext((prev) => ({
        ...prev,
        tournaments: scoreManagerCache.tournaments,
      }))
      if (!manualTournamentId && scoreManagerCache.tournaments[0]?.id) {
        setManualTournamentId(scoreManagerCache.tournaments[0].id)
      }
      return
    }

    let active = true
    const loadManualContext = async () => {
      try {
        const data = await fetchManualScoreContext()
        if (!active) return
        const tournaments = data?.tournaments || []
        setManualScoreContext((prev) => ({ ...prev, tournaments }))
        setScoreManagerCache((prev) => ({
          ...prev,
          tournaments,
        }))
        if (!manualTournamentId && data?.selectedTournamentId) {
          setManualTournamentId(data.selectedTournamentId)
        }
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load match score context')
      }
    }
    loadManualContext()
    return () => {
      active = false
    }
  }, [manualTournamentId, scoreManagerCache?.tournaments, setScoreManagerCache])

  useEffect(() => {
    if (!manualTournamentId) {
      setManualScoreContext((prev) => ({ ...prev, matches: [] }))
      return
    }

    const cachedMatches = scoreManagerCache?.matchesByTournament?.[manualTournamentId]
    if (Array.isArray(cachedMatches)) {
      setManualScoreContext((prev) => ({ ...prev, matches: cachedMatches }))
      setManualMatchId((prev) => {
        const hasSelectedMatch = cachedMatches.some((item) => item.id === prev)
        if ((!prev || !hasSelectedMatch) && cachedMatches.length) {
          return cachedMatches[0].id
        }
        return prev
      })
      return
    }

    let active = true
    const loadTournamentMatches = async () => {
      try {
        const matches = await fetchTournamentMatches(manualTournamentId)
        if (!active) return
        setManualScoreContext((prev) => ({ ...prev, matches: matches || [] }))
        setScoreManagerCache((prev) => ({
          ...prev,
          matchesByTournament: {
            ...(prev.matchesByTournament || {}),
            [manualTournamentId]: matches || [],
          },
        }))
        setManualMatchId((prev) => {
          const safeMatches = matches || []
          const hasSelectedMatch = safeMatches.some((item) => item.id === prev)
          if ((!prev || !hasSelectedMatch) && safeMatches.length) {
            return safeMatches[0].id
          }
          return prev
        })
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load matches')
      }
    }

    loadTournamentMatches()
    return () => {
      active = false
    }
  }, [manualTournamentId, scoreManagerCache?.matchesByTournament, setScoreManagerCache])

  const filteredManualContests = useMemo(() => {
    const contestManagerScopeId =
      currentUser?.role === 'contest_manager'
        ? currentUser?.contestManagerContestId || ''
        : ''
    return (allContests || []).filter((contest) => {
      const tournamentOk =
        !manualTournamentId || contest.tournamentId === manualTournamentId
      const scopeOk = !contestManagerScopeId || contest.id === contestManagerScopeId
      return tournamentOk && scopeOk
    })
  }, [allContests, manualTournamentId, currentUser])

  useEffect(() => {
    if (!filteredManualContests.length) {
      setManualContestId('')
      return
    }
    const exists = filteredManualContests.some((item) => item.id === manualContestId)
    if (!exists) {
      setManualContestId(filteredManualContests[0].id)
    }
  }, [filteredManualContests, manualContestId])

  useEffect(() => {
    if (!manualMatchId) {
      setManualTeamPool({
        teamAName: 'Team A',
        teamBName: 'Team B',
        teamAPlayers: [],
        teamBPlayers: [],
        teamALineup: null,
        teamBLineup: null,
      })
      setManualPlayingXi({ teamA: [], teamB: [] })
      setManualPlayerStats({})
      return
    }

    const cacheKey = `${manualTournamentId}::${manualMatchId}`
    const cachedTeamPool = scoreManagerCache?.teamPoolByMatch?.[cacheKey]
    const cachedSavedScore = scoreManagerCache?.savedScoresByMatch?.[cacheKey]
    const cachedPlayingXi = scoreManagerCache?.playingXiByMatch?.[cacheKey]
    if (cachedTeamPool) {
      setManualTeamPool(cachedTeamPool)
      if (cachedPlayingXi) {
        setManualPlayingXi(cachedPlayingXi)
      }
      setManualPlayerStats(
        buildManualStatsState(
          [
            ...(cachedTeamPool.teamAPlayers || []),
            ...(cachedTeamPool.teamBPlayers || []),
          ],
          cachedSavedScore?.playerStats || [],
        ),
      )
      return
    }

    let active = true
    const loadTeamPool = async () => {
      try {
        setIsLoadingManualPool(true)
        const [data, savedScore] = await Promise.all([
          fetchTeamPool({
            contestId: undefined,
            tournamentId: manualTournamentId,
            matchId: manualMatchId,
          }),
          fetchAdminMatchScores({
            tournamentId: manualTournamentId,
            matchId: manualMatchId,
          }).catch(() => null),
        ])
        if (!active) return
        const teamAPlayers = data?.teams?.teamA?.players || []
        const teamBPlayers = data?.teams?.teamB?.players || []
        const nextTeamPool = {
          teamAName: data?.teams?.teamA?.name || 'Team A',
          teamBName: data?.teams?.teamB?.name || 'Team B',
          teamAPlayers,
          teamBPlayers,
          teamALineup: data?.teams?.teamA?.lineup || null,
          teamBLineup: data?.teams?.teamB?.lineup || null,
        }
        setManualTeamPool(nextTeamPool)
        const defaultPlayingA =
          data?.teams?.teamA?.lineup?.playingXI?.length >= 11
            ? data.teams.teamA.lineup.playingXI
            : []
        const defaultPlayingB =
          data?.teams?.teamB?.lineup?.playingXI?.length >= 11
            ? data.teams.teamB.lineup.playingXI
            : []
        const nextPlayingXi = {
          teamA: defaultPlayingA,
          teamB: defaultPlayingB,
        }
        setManualPlayingXi(nextPlayingXi)
        setManualPlayerStats(
          buildManualStatsState(
            [...teamAPlayers, ...teamBPlayers],
            savedScore?.playerStats || [],
          ),
        )
        setScoreManagerCache((prev) => ({
          ...prev,
          teamPoolByMatch: {
            ...(prev.teamPoolByMatch || {}),
            [cacheKey]: nextTeamPool,
          },
          savedScoresByMatch: {
            ...(prev.savedScoresByMatch || {}),
            [cacheKey]: savedScore || null,
          },
          playingXiByMatch: {
            ...(prev.playingXiByMatch || {}),
            [cacheKey]: nextPlayingXi,
          },
        }))
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load playing XI for manual scoring')
      } finally {
        if (active) {
          setIsLoadingManualPool(false)
        }
      }
    }
    loadTeamPool()
    return () => {
      active = false
    }
  }, [manualMatchId, manualTournamentId])

  useEffect(() => {
    if (!manualTournamentId || !manualMatchId) return
    const cacheKey = `${manualTournamentId}::${manualMatchId}`
    setScoreManagerCache((prev) => ({
      ...prev,
      playingXiByMatch: {
        ...(prev.playingXiByMatch || {}),
        [cacheKey]: manualPlayingXi,
      },
    }))
  }, [manualPlayingXi, manualTournamentId, manualMatchId, setScoreManagerCache])

  const filteredJoined = useMemo(() => {
    return pageLoadData.joinedContests.filter((contest) => {
      const tournamentOk =
        selectedTournament === 'all' || contest.tournamentId === selectedTournament
      const statusOk = selectedStatus === 'all' || contest.status === selectedStatus
      return tournamentOk && statusOk
    })
  }, [pageLoadData.joinedContests, selectedTournament, selectedStatus])

  const groupedJoined = useMemo(
    () =>
      filteredJoined.reduce((acc, contest) => {
        if (!acc[contest.game]) acc[contest.game] = []
        acc[contest.game].push(contest)
        return acc
      }, {}),
    [filteredJoined],
  )

  const allStatuses = useMemo(
    () => [
      'all',
      ...Array.from(
        new Set(pageLoadData.joinedContests.map((contest) => contest.status)),
      ),
    ],
    [pageLoadData.joinedContests],
  )

  const tournamentNameMap = useMemo(() => {
    return pageLoadData.tournaments.reduce((acc, item) => {
      acc[item.id] = item.name
      return acc
    }, {})
  }, [pageLoadData.tournaments])

  const infoPanelMap = {
    admin: pageLoadData.adminManager,
    audit: pageLoadData.auditLogs,
  }
  const showMasterTools = currentUser?.role === 'master_admin'
  const showAdminTools = ['admin', 'master_admin', 'contest_manager'].includes(
    currentUser?.role,
  )
  const visibleAdminMenuItems = useMemo(() => {
    if (!showAdminTools) return []
    if (currentUser?.role === 'contest_manager') {
      return adminMenuItems.filter(
        (item) => item.key === 'playingXiManager' || item.key === 'scoreManager',
      )
    }
    return adminMenuItems
  }, [currentUser?.role, showAdminTools])
  const visibleMenuItems = useMemo(
    () => [
      ...regularMenuItems,
      ...visibleAdminMenuItems,
      ...(showMasterTools ? masterMenuItems : []),
    ],
    [showMasterTools, visibleAdminMenuItems],
  )
  const mobilePanelOptions = useMemo(
    () => [
      ...regularMenuItems.map((item) => ({
        value: item.key,
        label: item.label,
      })),
      ...(showAdminTools
        ? visibleAdminMenuItems.map((item) => ({
            value: item.key,
            label: `Admin • ${item.label}`,
          }))
        : []),
      ...(showMasterTools
        ? [
            ...masterMenuItems.map((item) => ({
              value: item.key,
              label: `Master • ${item.label}`,
            })),
            { value: '__all-pages__', label: 'Master • All Pages' },
            { value: '__all-apis__', label: 'Master • All APIs' },
          ]
        : []),
    ],
    [showAdminTools, showMasterTools, visibleAdminMenuItems],
  )
  const canEditScoringRules = ['admin', 'master_admin'].includes(currentUser?.role)
  const isInitialLoading =
    isLoading && !pageLoadData.tournaments.length && !pageLoadData.joinedContests.length
  const showApiFailureTile =
    !isLoading &&
    !!errorText &&
    !pageLoadData.tournaments.length &&
    !pageLoadData.joinedContests.length
  const validPanelKeys = useMemo(
    () => new Set(visibleMenuItems.map((item) => item.key)),
    [visibleMenuItems],
  )

  useEffect(() => {
    if (!validPanelKeys.has(activePanel)) {
      selectPanel('joined')
    }
  }, [activePanel, validPanelKeys])

  const updateRuleValue = (section, id, value) => {
    setPointsRules((prev) => ({
      ...prev,
      [section]: prev[section].map((row) =>
        row.id === id ? { ...row, value: Number(value) || 0 } : row,
      ),
    }))
  }

  const onSaveRules = async () => {
    if (!canEditScoringRules || !isRulesEditEnabled) return
    try {
      setSaveNotice('')
      setErrorText('')
      setIsSavingRules(true)
      await saveScoringRules({
        rules: pointsRules,
        actorUserId: currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      })
      setSaveNotice('Scoring rules saved')
      setIsRulesEditEnabled(false)
    } catch (error) {
      setErrorText(error.message || 'Failed to save rules')
    } finally {
      setIsSavingRules(false)
    }
  }

  const onSaveScores = async () => {
    try {
      if (!manualTournamentId || !manualMatchId) return
      setSaveNotice('')
      setErrorText('')
      setScoreJsonUnmatchedDetails([])

      const parsed = JSON.parse(uploadPayloadText || '{}')
      const playerStats = Array.isArray(parsed?.playerStats) ? parsed.playerStats : []
      const knownPlayers = [
        ...(manualTeamPool?.teamAPlayers || []),
        ...(manualTeamPool?.teamBPlayers || []),
      ]
      const knownById = new Set(
        knownPlayers.map((player) => String(player.id || '').trim()),
      )
      const knownByName = new Map(
        knownPlayers.map((player) => [normalizeLooseKey(player.name), player.name]),
      )
      const knownNames = knownPlayers.map((player) => String(player.name || '').trim())
      const buildSuggestions = (needle) => {
        const compactNeedle = normalizeLooseKey(needle)
        if (!compactNeedle) return []
        return knownNames
          .map((name) => ({
            name,
            compact: normalizeLooseKey(name),
          }))
          .filter(
            (item) =>
              item.compact.includes(compactNeedle) ||
              compactNeedle.includes(item.compact),
          )
          .slice(0, 5)
          .map((item) => item.name)
      }
      const unmatchedDetails = playerStats
        .map((row) => {
          const rawId = String(row?.playerId || '').trim()
          if (rawId && knownById.has(rawId)) return null
          const inputName = String(row?.playerName || row?.name || '').trim()
          const normalizedInput = normalizeLooseKey(inputName)
          if (normalizedInput && knownByName.has(normalizedInput)) return null
          if (!rawId && !inputName) return null
          return {
            input: inputName || rawId,
            normalizedInput: normalizeManualPlayerKey(inputName || rawId),
            suggestions: buildSuggestions(inputName || rawId),
          }
        })
        .filter(Boolean)
      if (unmatchedDetails.length > 0) {
        setScoreJsonUnmatchedDetails(unmatchedDetails)
        setErrorText(
          'Some players could not be mapped to this match. Fix names and retry.',
        )
        return
      }

      setIsSavingScores(true)
      const effectiveContestId =
        manualContestId ||
        filteredManualContests.find((item) => item.tournamentId === manualTournamentId)
          ?.id ||
        ''
      const response = await saveMatchScores({
        payloadText: uploadPayloadText,
        fileName: '',
        processedPayload: null,
        dryRun: false,
        source: 'json',
        tournamentId: manualTournamentId,
        contestId: effectiveContestId,
        matchId: manualMatchId,
        userId: currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      })
      const impacted = Number(response?.impactedContests || 0)
      const updatedAt = response?.lastScoreUpdatedAt
        ? new Date(response.lastScoreUpdatedAt).toLocaleString()
        : 'now'
      setSaveNotice(
        `Match scores payload saved • ${impacted} contests updated • ${updatedAt}`,
      )
      if (response?.savedScore && typeof response.savedScore === 'object') {
        cacheSavedScoreForMatch({
          tournamentId: manualTournamentId,
          matchId: manualMatchId,
          savedScore: response.savedScore,
        })
        applyManualStatsFromSavedScore({
          teamAPlayers: manualTeamPool.teamAPlayers,
          teamBPlayers: manualTeamPool.teamBPlayers,
          savedScore: response.savedScore,
        })
      } else {
        await refreshManualStatsState({
          tournamentId: manualTournamentId,
          matchId: manualMatchId,
          teamAPlayers: manualTeamPool.teamAPlayers,
          teamBPlayers: manualTeamPool.teamBPlayers,
          forceRefresh: true,
        })
      }
    } catch (error) {
      const details = Array.isArray(error?.data?.unmatchedDetails)
        ? error.data.unmatchedDetails
        : []
      setScoreJsonUnmatchedDetails(details)
      setErrorText(error.message || 'Failed to save match scores')
    } finally {
      setIsSavingScores(false)
    }
  }

  const onGenerateScoreJson = () => {
    if (!manualTournamentId || !manualMatchId) {
      setErrorText('Select tournament and match before generating JSON')
      return
    }

    const cacheKey = `${manualTournamentId}::${manualMatchId}`
    const cached = scoreManagerCache?.generatedScoreJsonByMatch?.[cacheKey]
    if (cached) {
      setGeneratedScoreJsonText(cached)
      setIsGeneratedScoreJsonOpen(true)
      setUploadPayloadText(cached)
      return
    }

    const resolveTeamRows = (players = [], selectedNames = []) => {
      const byName = new Map(
        (players || []).map((player) => [normalizeManualPlayerKey(player.name), player]),
      )
      const resolved = []
      const missing = []
      ;(selectedNames || []).forEach((name) => {
        const key = normalizeManualPlayerKey(name)
        const match = byName.get(key)
        if (!match) {
          missing.push(name)
          return
        }
        resolved.push(match)
      })
      return { resolved, missing }
    }

    const teamASelected = Array.isArray(manualPlayingXi?.teamA)
      ? manualPlayingXi.teamA
      : []
    const teamBSelected = Array.isArray(manualPlayingXi?.teamB)
      ? manualPlayingXi.teamB
      : []
    if (teamASelected.length < 11 || teamBSelected.length < 11) {
      setErrorText(
        'Playing XI is missing. Save Playing XI first, then generate score JSON.',
      )
      return
    }

    const resolvedTeamA = resolveTeamRows(
      manualTeamPool?.teamAPlayers || [],
      teamASelected,
    )
    const resolvedTeamB = resolveTeamRows(
      manualTeamPool?.teamBPlayers || [],
      teamBSelected,
    )
    const unresolvedNames = [...resolvedTeamA.missing, ...resolvedTeamB.missing]
    if (unresolvedNames.length > 0) {
      setErrorText(
        `Playing XI has unmapped players: ${unresolvedNames.join(', ')}. Re-save Playing XI and retry.`,
      )
      return
    }

    const buildRow = (player) => ({
      playerId: player.id,
      playerName: player.name,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      wickets: 0,
      overs: 0,
      maidens: 0,
      runsConceded: 0,
      noBalls: 0,
      wides: 0,
      catches: 0,
      stumpings: 0,
      runoutDirect: 0,
      runoutIndirect: 0,
      dismissed: false,
    })

    const generated = {
      playerStats: [...resolvedTeamA.resolved, ...resolvedTeamB.resolved].map(buildRow),
    }
    const payloadText = JSON.stringify(generated, null, 2)
    setScoreManagerCache((prev) => ({
      ...prev,
      generatedScoreJsonByMatch: {
        ...(prev.generatedScoreJsonByMatch || {}),
        [cacheKey]: payloadText,
      },
    }))
    setGeneratedScoreJsonText(payloadText)
    setUploadPayloadText(payloadText)
    setScoreJsonUnmatchedDetails([])
    setErrorText('')
    setIsGeneratedScoreJsonOpen(true)
  }

  const onCloseGeneratedScoreJson = () => {
    setIsGeneratedScoreJsonOpen(false)
  }

  const onManualStatChange = (playerId, field, value) => {
    setManualPlayerStats((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [field]: field === 'dismissed' ? Boolean(value) : Number(value) || 0,
      },
    }))
  }

  const onToggleManualPlayingXi = (side, playerName) => {
    setManualPlayingXi((prev) => {
      const current = Array.isArray(prev?.[side]) ? prev[side] : []
      const exists = current.includes(playerName)
      if (exists) {
        return {
          ...prev,
          [side]: current.filter((item) => item !== playerName),
        }
      }
      if (current.length >= 12) return prev
      return {
        ...prev,
        [side]: [...current, playerName],
      }
    })
  }

  const onSaveManualLineups = async () => {
    try {
      if (!manualTournamentId || !manualMatchId) return
      setSaveNotice('')
      setErrorText('')
      setIsSavingScores(true)
      const buildPayloadForTeam = (players, selectedNames, existingLineup) => {
        const squad = players.map((player) => player.name)
        const playingXI = squad.filter((name) => selectedNames.includes(name))
        return {
          squad,
          playingXI,
          bench: squad.filter((name) => !selectedNames.includes(name)),
          captain:
            existingLineup?.captain && playingXI.includes(existingLineup.captain)
              ? existingLineup.captain
              : undefined,
          viceCaptain:
            existingLineup?.viceCaptain && playingXI.includes(existingLineup.viceCaptain)
              ? existingLineup.viceCaptain
              : undefined,
        }
      }

      const payload = {
        [manualTeamPool.teamAName]: buildPayloadForTeam(
          manualTeamPool.teamAPlayers,
          manualPlayingXi.teamA,
          manualTeamPool.teamALineup,
        ),
        [manualTeamPool.teamBName]: buildPayloadForTeam(
          manualTeamPool.teamBPlayers,
          manualPlayingXi.teamB,
          manualTeamPool.teamBLineup,
        ),
      }

      await upsertMatchLineups({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
        updatedBy:
          currentUser?.gameName || currentUser?.email || currentUser?.id || 'admin',
        source: 'manual-xi',
        lineups: payload,
      })
      setManualTeamPool((prev) => ({
        ...prev,
        teamALineup: payload[prev.teamAName],
        teamBLineup: payload[prev.teamBName],
      }))
      const cacheKey = `${manualTournamentId}::${manualMatchId}`
      setScoreManagerCache((prev) => ({
        ...prev,
        teamPoolByMatch: {
          ...(prev.teamPoolByMatch || {}),
          [cacheKey]: {
            ...(prev.teamPoolByMatch?.[cacheKey] || manualTeamPool),
            teamALineup: payload[manualTeamPool.teamAName],
            teamBLineup: payload[manualTeamPool.teamBName],
          },
        },
      }))
      setSaveNotice('Playing XI saved')
    } catch (error) {
      setErrorText(error.message || 'Failed to save playing XI')
    } finally {
      setIsSavingScores(false)
    }
  }

  const onSaveLineupsFromJson = async () => {
    try {
      if (!manualTournamentId || !manualMatchId) return
      setSaveNotice('')
      setErrorText('')
      setIsSavingScores(true)
      const parsed = JSON.parse(lineupPayloadText || '{}')
      const lineups =
        parsed?.lineups && typeof parsed.lineups === 'object' ? parsed.lineups : parsed
      const response = await upsertMatchLineups({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
        updatedBy:
          currentUser?.gameName || currentUser?.email || currentUser?.id || 'admin',
        source: 'json-lineup',
        dryRun: true,
        strictSquad: false,
        lineups,
        meta: parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta : {},
      })
      setLineupPreviewPayload(response?.saved?.lineups || {})
      setIsLineupPreviewOpen(true)
    } catch (error) {
      setErrorText(error.message || 'Failed to save lineup JSON')
    } finally {
      setIsSavingScores(false)
    }
  }

  const onGenerateLineupsJson = () => {
    if (!manualTournamentId || !manualMatchId) {
      setErrorText('Select tournament and match before generating Playing XI JSON')
      return
    }

    const teamAPlayers = manualTeamPool?.teamAPlayers || []
    const teamBPlayers = manualTeamPool?.teamBPlayers || []
    if (!teamAPlayers.length || !teamBPlayers.length) {
      setErrorText('Load match squads first, then generate Playing XI JSON')
      return
    }

    const buildTeamPayload = (players = [], selected = []) => {
      const squad = players.map((player) => player.name).filter(Boolean)
      const selectedSet = new Set(
        (selected || []).map((name) => String(name || '').trim()),
      )
      const playingXI = squad.filter((name) => selectedSet.has(name)).slice(0, 12)
      const bench = squad.filter((name) => !playingXI.includes(name))
      return { squad, playingXI, bench }
    }

    const teamAName = manualTeamPool?.teamAName || 'Team A'
    const teamBName = manualTeamPool?.teamBName || 'Team B'

    const generated = {
      lineups: {
        [teamAName]: buildTeamPayload(teamAPlayers, manualPlayingXi?.teamA || []),
        [teamBName]: buildTeamPayload(teamBPlayers, manualPlayingXi?.teamB || []),
      },
      meta: {
        source: 'generated-playing-xi-json',
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
      },
    }

    setGeneratedLineupJsonText(JSON.stringify(generated, null, 2))
    setIsGeneratedLineupJsonOpen(true)
    setErrorText('')
    setSaveNotice('Playing XI JSON generated. Copy and paste it into JSON Upload.')
  }

  const onCloseGeneratedLineupJson = () => {
    setIsGeneratedLineupJsonOpen(false)
  }

  const onCloseLineupPreview = () => {
    setIsLineupPreviewOpen(false)
  }

  const onConfirmLineupPreviewSave = async () => {
    try {
      if (!manualTournamentId || !manualMatchId) return
      if (!lineupPreviewPayload || typeof lineupPreviewPayload !== 'object') return
      const lineupsToSave = lineupPreviewPayload
      setIsLineupPreviewOpen(false)
      setSaveNotice('')
      setErrorText('')
      setIsSavingScores(true)

      const response = await upsertMatchLineups({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
        updatedBy:
          currentUser?.gameName || currentUser?.email || currentUser?.id || 'admin',
        source: 'json-lineup',
        dryRun: false,
        strictSquad: false,
        lineups: lineupsToSave,
        meta: {},
      })
      const saved = response?.saved?.lineups || {}
      setManualTeamPool((prev) => ({
        ...prev,
        teamALineup: saved[prev.teamAName] || prev.teamALineup,
        teamBLineup: saved[prev.teamBName] || prev.teamBLineup,
      }))
      const nextPlayingXi = {
        teamA: saved[manualTeamPool.teamAName]?.playingXI || manualPlayingXi.teamA,
        teamB: saved[manualTeamPool.teamBName]?.playingXI || manualPlayingXi.teamB,
      }
      setManualPlayingXi(nextPlayingXi)
      const cacheKey = `${manualTournamentId}::${manualMatchId}`
      setScoreManagerCache((prev) => ({
        ...prev,
        teamPoolByMatch: {
          ...(prev.teamPoolByMatch || {}),
          [cacheKey]: {
            ...(prev.teamPoolByMatch?.[cacheKey] || manualTeamPool),
            teamALineup: saved[manualTeamPool.teamAName] || manualTeamPool.teamALineup,
            teamBLineup: saved[manualTeamPool.teamBName] || manualTeamPool.teamBLineup,
          },
        },
        playingXiByMatch: {
          ...(prev.playingXiByMatch || {}),
          [cacheKey]: nextPlayingXi,
        },
      }))
      setSaveNotice('Playing XI JSON saved')
      setLineupPayloadText('')
      setLineupPreviewPayload(null)
      setIsLineupPreviewOpen(false)
    } catch (error) {
      setErrorText(error.message || 'Failed to save lineup JSON')
    } finally {
      setIsSavingScores(false)
    }
  }

  const onSaveManualScores = async () => {
    try {
      if (!manualTournamentId || !manualMatchId) return
      setSaveNotice('')
      setErrorText('')
      setIsSavingScores(true)
      const rows = [...manualTeamPool.teamAPlayers, ...manualTeamPool.teamBPlayers].map(
        (player) => ({
          playerId: player.id,
          playerName: player.name,
          ...(manualPlayerStats[player.id] || {}),
        }),
      )
      const effectiveContestId =
        manualContestId ||
        filteredManualContests.find((item) => item.tournamentId === manualTournamentId)
          ?.id ||
        ''
      const response = await upsertManualMatchScores({
        tournamentId: manualTournamentId,
        contestId: effectiveContestId,
        matchId: manualMatchId,
        userId: currentUser?.gameName || currentUser?.email || currentUser?.id || '',
        playerStats: rows,
        teamScore: {},
      })
      const impacted = Number(response?.impactedContests || 0)
      const updatedAt = response?.lastScoreUpdatedAt
        ? new Date(response.lastScoreUpdatedAt).toLocaleString()
        : 'now'
      setSaveNotice(`Manual scores saved • ${impacted} contests updated • ${updatedAt}`)
      if (response?.savedScore && typeof response.savedScore === 'object') {
        cacheSavedScoreForMatch({
          tournamentId: manualTournamentId,
          matchId: manualMatchId,
          savedScore: response.savedScore,
        })
        applyManualStatsFromSavedScore({
          teamAPlayers: manualTeamPool.teamAPlayers,
          teamBPlayers: manualTeamPool.teamBPlayers,
          savedScore: response.savedScore,
        })
      } else {
        await refreshManualStatsState({
          tournamentId: manualTournamentId,
          matchId: manualMatchId,
          teamAPlayers: manualTeamPool.teamAPlayers,
          teamBPlayers: manualTeamPool.teamBPlayers,
          forceRefresh: true,
        })
      }
    } catch (error) {
      setErrorText(error.message || 'Failed to save manual scores')
    } finally {
      setIsSavingScores(false)
    }
  }

  const onResetManualScores = async () => {
    try {
      if (!manualTournamentId || !manualMatchId) return
      const shouldReset = window.confirm(
        'Reset scores for this match? This will void saved score versions and clear derived points for the selected match.',
      )
      if (!shouldReset) return

      setSaveNotice('')
      setErrorText('')
      setIsSavingScores(true)

      const response = await resetManualMatchScores({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
        userId: currentUser?.gameName || currentUser?.email || currentUser?.id || '',
      })

      const impacted = Number(response?.impactedContests || 0)
      setSaveNotice(`Match scores reset • ${impacted} contests updated`)
      cacheSavedScoreForMatch({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
        savedScore: null,
      })

      await refreshManualStatsState({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
        teamAPlayers: manualTeamPool.teamAPlayers,
        teamBPlayers: manualTeamPool.teamBPlayers,
      })
    } catch (error) {
      setErrorText(error.message || 'Failed to reset match scores')
    } finally {
      setIsSavingScores(false)
    }
  }

  const onReplaceManualBackups = async () => {
    try {
      if (!manualMatchId) return
      const shouldReplace = window.confirm(
        'Replace backups for this match using the latest Playing XI and saved selections?',
      )
      if (!shouldReplace) return

      setSaveNotice('')
      setErrorText('')
      setIsSavingScores(true)

      const result = await replaceAdminMatchBackups({ id: manualMatchId })
      const updatedSelections = Number(result?.autoReplacement?.updatedSelections || 0)
      const skippedSelections = Number(result?.autoReplacement?.skippedSelections || 0)
      setSaveNotice(
        `Backups replaced (${updatedSelections} updated, ${skippedSelections} skipped)`,
      )
    } catch (error) {
      setErrorText(error.message || 'Failed to replace backups')
    } finally {
      setIsSavingScores(false)
    }
  }

  const panelMap = {
    joined: (
      <JoinedPanel
        selectedTournament={selectedTournament}
        setSelectedTournament={setSelectedTournament}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        tournaments={pageLoadData.tournaments}
        allStatuses={allStatuses}
        groupedJoined={groupedJoined}
        tournamentNameMap={tournamentNameMap}
        errorText={errorText}
      />
    ),
    points: (
      <PointsPanel
        pointsRules={pointsRules}
        canEditRules={canEditScoringRules}
        isEditMode={isRulesEditEnabled}
        onEnableEdit={() => setIsRulesEditEnabled(true)}
        onDisableEdit={() => setIsRulesEditEnabled(false)}
        isSavingRules={isSavingRules}
        updateRuleValue={updateRuleValue}
        onSaveRules={onSaveRules}
      />
    ),
    createTournament: (
      <CreateTournamentPanel
        onCreated={(payload) => {
          if (payload?.openAdmin) {
            selectPanel('tournamentManager')
          }
        }}
      />
    ),
    userManager: <UserManagerPanel showPending={showMasterTools} />,
    tournamentManager: <TournamentManagerPanel />,
    contestManager: <AdminManagerPanel initialTab="contests" hideTabs />,
    players: <PlayerManagerPanel />,
    squads: <SquadManagerPanel />,
    admin: <UserManagerPanel showPending={showMasterTools} />,
    playingXiManager: (
      <UploadPanel
        forcedMatchOpsTab="lineups"
        hideMatchOpsTabs
        uploadTab={uploadTab}
        setUploadTab={setUploadTab}
        uploadPayloadText={uploadPayloadText}
        setUploadPayloadText={setUploadPayloadText}
        scoreJsonUnmatchedDetails={scoreJsonUnmatchedDetails}
        lineupPayloadText={lineupPayloadText}
        setLineupPayloadText={setLineupPayloadText}
        manualScoreContext={manualScoreContext}
        manualTournamentId={manualTournamentId}
        setManualTournamentId={setManualTournamentId}
        manualMatchId={manualMatchId}
        setManualMatchId={setManualMatchId}
        manualTeamPool={manualTeamPool}
        manualPlayerStats={manualPlayerStats}
        manualPlayingXi={manualPlayingXi}
        onToggleManualPlayingXi={onToggleManualPlayingXi}
        onSaveManualLineups={onSaveManualLineups}
        onGenerateLineupsJson={onGenerateLineupsJson}
        onSaveLineupsFromJson={onSaveLineupsFromJson}
        isGeneratedLineupJsonOpen={isGeneratedLineupJsonOpen}
        generatedLineupJsonText={generatedLineupJsonText}
        onCloseGeneratedLineupJson={onCloseGeneratedLineupJson}
        isLineupPreviewOpen={isLineupPreviewOpen}
        lineupPreviewPayload={lineupPreviewPayload}
        onCloseLineupPreview={onCloseLineupPreview}
        onConfirmLineupPreviewSave={onConfirmLineupPreviewSave}
        onReplaceManualBackups={onReplaceManualBackups}
        onManualStatChange={onManualStatChange}
        onSaveManualScores={onSaveManualScores}
        onResetManualScores={onResetManualScores}
        isLoadingManualPool={isLoadingManualPool}
        onSaveScores={onSaveScores}
        onGenerateScoreJson={onGenerateScoreJson}
        isGeneratedScoreJsonOpen={isGeneratedScoreJsonOpen}
        generatedScoreJsonText={generatedScoreJsonText}
        onCloseGeneratedScoreJson={onCloseGeneratedScoreJson}
        isSavingScores={isSavingScores}
      />
    ),
    scoreManager: (
      <UploadPanel
        forcedMatchOpsTab="scores"
        hideMatchOpsTabs
        uploadTab={uploadTab}
        setUploadTab={setUploadTab}
        uploadPayloadText={uploadPayloadText}
        setUploadPayloadText={setUploadPayloadText}
        scoreJsonUnmatchedDetails={scoreJsonUnmatchedDetails}
        lineupPayloadText={lineupPayloadText}
        setLineupPayloadText={setLineupPayloadText}
        manualScoreContext={manualScoreContext}
        manualTournamentId={manualTournamentId}
        setManualTournamentId={setManualTournamentId}
        manualMatchId={manualMatchId}
        setManualMatchId={setManualMatchId}
        manualTeamPool={manualTeamPool}
        manualPlayerStats={manualPlayerStats}
        manualPlayingXi={manualPlayingXi}
        onToggleManualPlayingXi={onToggleManualPlayingXi}
        onSaveManualLineups={onSaveManualLineups}
        onSaveLineupsFromJson={onSaveLineupsFromJson}
        isGeneratedLineupJsonOpen={isGeneratedLineupJsonOpen}
        generatedLineupJsonText={generatedLineupJsonText}
        onCloseGeneratedLineupJson={onCloseGeneratedLineupJson}
        isLineupPreviewOpen={isLineupPreviewOpen}
        lineupPreviewPayload={lineupPreviewPayload}
        onCloseLineupPreview={onCloseLineupPreview}
        onConfirmLineupPreviewSave={onConfirmLineupPreviewSave}
        onReplaceManualBackups={onReplaceManualBackups}
        onManualStatChange={onManualStatChange}
        onSaveManualScores={onSaveManualScores}
        onResetManualScores={onResetManualScores}
        isLoadingManualPool={isLoadingManualPool}
        onSaveScores={onSaveScores}
        onGenerateScoreJson={onGenerateScoreJson}
        isGeneratedScoreJsonOpen={isGeneratedScoreJsonOpen}
        generatedScoreJsonText={generatedScoreJsonText}
        onCloseGeneratedScoreJson={onCloseGeneratedScoreJson}
        isSavingScores={isSavingScores}
      />
    ),
    audit: (
      <AuditLogsPanel
        rows={infoPanelMap.audit || []}
        tournaments={pageLoadData.tournaments}
      />
    ),
    approvals: (
      <>
        <AdminManagerPanel initialTab="users" hideTabs />
        {showMasterTools && <PendingApprovalsPanel />}
      </>
    ),
  }

  // Special case: render upload panel as full-width, no nav, no grid
  // REVERT: Remove special upload panel layout, restore original dashboard grid/nav structure

  return (
    <section className={`dashboard-shell panel-${activePanel}`.trim()}>
      {/* Always show left nav for all panels, including upload */}
      <aside className="dashboard-left-nav">
        {regularMenuItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`dashboard-nav-btn ${activePanel === item.key ? 'active' : ''}`.trim()}
            onClick={() => selectPanel(item.key)}
          >
            <span>{item.label}</span>
          </button>
        ))}
        {showAdminTools && (
          <>
            <div className="dashboard-nav-divider" />
            <p className="dashboard-nav-section-label">Admin</p>
            {visibleAdminMenuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`dashboard-nav-btn ${activePanel === item.key ? 'active' : ''}`.trim()}
                onClick={() => selectPanel(item.key)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </>
        )}
        {showMasterTools && (
          <>
            <div className="dashboard-nav-divider" />
            <p className="dashboard-nav-section-label">Master</p>
            {masterMenuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`dashboard-nav-btn ${activePanel === item.key ? 'active' : ''}`.trim()}
                onClick={() => selectPanel(item.key)}
              >
                <span>{item.label}</span>
              </button>
            ))}
            <Link to="/all-pages" className="dashboard-nav-btn dashboard-nav-link">
              <span>All Pages</span>
            </Link>
            <Link to="/all-apis" className="dashboard-nav-btn dashboard-nav-link">
              <span>All APIs</span>
            </Link>
          </>
        )}
      </aside>

      <div className="dashboard-content">
        <div className="dashboard-mobile-panel-select">
          <label htmlFor="dashboard-panel-select">Dashboard section</label>
          <select
            id="dashboard-panel-select"
            value={mobilePanelValue}
            onChange={(event) => selectPanel(event.target.value)}
          >
            {mobilePanelOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="section-head-compact">
          <h2>{sectionTitles[activePanel]}</h2>
          {isLoading && <p className="team-note">Loading dashboard...</p>}
          {!showApiFailureTile && !!errorText && (
            <p className="error-text">{errorText}</p>
          )}
          {!!saveNotice && panelsWithGlobalSaveNotice.has(activePanel) && (
            <p className="success-text">{saveNotice}</p>
          )}
        </div>
        <div className="dashboard-panel-view">
          {showApiFailureTile ? (
            <ApiFailureTile
              title="Dashboard feed unavailable"
              message={errorText}
              onRetry={() => window.location.reload()}
            />
          ) : isInitialLoading ? (
            <div className="dashboard-loading-screen" role="status" aria-live="polite">
              <div className="dashboard-loading-shimmer heading" />
              <div className="dashboard-loading-shimmer line" />
              <div className="dashboard-loading-shimmer line" />
              <div className="dashboard-loading-shimmer line short" />
            </div>
          ) : (
            panelMap[activePanel]
          )}
        </div>
      </div>
    </section>
  )
}

export default Dashboard
