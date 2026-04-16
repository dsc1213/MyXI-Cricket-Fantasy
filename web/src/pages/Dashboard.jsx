import { useCallback, useEffect, useMemo, useState } from 'react'
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
  updateAdminMatchStatus,
  upsertMatchLineups,
  upsertManualMatchScores,
} from '../lib/api.js'
import AdminManagerPanel from './dashboard/AdminManagerPanel.jsx'
import AuditLogsPanel from './dashboard/AuditLogsPanel.jsx'
import CreateTournamentPanel from './dashboard/CreateTournamentPanel.jsx'
import JoinedPanel from './dashboard/JoinedPanel.jsx'
import PendingRemovalsPanel from './dashboard/PendingRemovalsPanel.jsx'
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
import { normalizePointsRuleTemplate } from '../lib/defaultPointsRules.js'
import {
  normalizeManualPlayerKey,
  normalizeLooseKey,
  buildNameSuggestions,
  resolveKnownPlayerByName,
  normalizeLineupTeamPayload,
} from './dashboard/utils.js'
import {
  defaultPointsRules,
  buildFallbackBootstrap,
} from './dashboard/stateBuilders.js'
import { buildManualStatsState } from './dashboard/manualStats.js'
import { parseNormalizedJsonInput } from '../lib/jsonInput.js'

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
  const [lineupJsonUnmatchedDetails, setLineupJsonUnmatchedDetails] = useState([])
  const [isGeneratedScoreJsonOpen, setIsGeneratedScoreJsonOpen] = useState(false)
  const [generatedScoreJsonText, setGeneratedScoreJsonText] = useState('')
  const [isScorePreviewOpen, setIsScorePreviewOpen] = useState(false)
  const [scorePreviewPayload, setScorePreviewPayload] = useState(null)
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
  const [allContests, setAllContests] = useState([])
  const currentUser = getStoredUser()
  const currentUserId =
    currentUser?.userId || currentUser?.gameName || currentUser?.email || ''
  const mobilePanelValue =
    activePanel === '__all-pages__' || activePanel === '__all-apis__'
      ? defaultPanel
      : activePanel
  const panelAliases = useMemo(
    () => ({
      admin: 'userManager',
      createTournament: 'tournamentManager',
      approvals: 'userManager',
      upload: 'scoreManager',
    }),
    [],
  )
  const panelsWithGlobalSaveNotice = new Set([
    'points',
    'playingXiManager',
    'scoreManager',
  ])
  const canAccessManualScorePanels = ['admin', 'master_admin', 'contest_manager'].includes(
    currentUser?.role,
  )
  const shouldLoadManualScoreContext =
    canAccessManualScorePanels &&
    ['scoreManager', 'playingXiManager'].includes(activePanel)

  const buildLineupUnmappedErrorMessage = (unmatched = []) => {
    const sample = (unmatched || [])
      .slice(0, 3)
      .map((item) => `${item.team}: ${item.input}`)
      .join(', ')
    const base = 'Lineup JSON contains unmapped players for the selected match squads.'
    const nextSteps =
      ' Next steps: 1) verify Tournament/Match selection, 2) use Generate JSON to start from current squads, 3) replace names using suggestions below, 4) save again.'
    return `${base}${sample ? ` Examples: ${sample}.` : ''}${nextSteps}`
  }

  const buildScoreUnmappedErrorMessage = (unmatched = []) => {
    const sample = (unmatched || [])
      .slice(0, 3)
      .map((item) => item.input)
      .join(', ')
    const base =
      'Scorecard JSON contains player names that do not match DB players for the selected match.'
    const nextSteps =
      ' Next steps: 1) verify Tournament/Match selection, 2) use Generate JSON to start from current DB players, 3) replace names using suggestions below, 4) save again.'
    return `${base}${sample ? ` Examples: ${sample}.` : ''}${nextSteps}`
  }

  const resolveTeamPlayersForInput = (teamName = '') => {
    const normalizedInput = normalizeLooseKey(teamName)
    const knownTeams = [
      {
        key: manualTeamPool?.teamAName || '',
        players: manualTeamPool?.teamAPlayers || [],
      },
      {
        key: manualTeamPool?.teamBName || '',
        players: manualTeamPool?.teamBPlayers || [],
      },
    ]
    const exactMatch = knownTeams.find(
      (team) => normalizeLooseKey(team.key) === normalizedInput,
    )
    if (exactMatch) return exactMatch
    return null
  }

  const canonicalizePlayingXiNames = (players = [], selectedNames = []) => {
    const canonical = []
    const seen = new Set()

    ;(Array.isArray(selectedNames) ? selectedNames : []).forEach((name) => {
      const resolved = resolveKnownPlayerByName(players, name)
      const nextName = String(resolved?.name || name || '').trim()
      const key = normalizeLooseKey(nextName)
      if (!nextName || !key || seen.has(key)) return
      seen.add(key)
      canonical.push(nextName)
    })

    return canonical
  }

  const canonicalizePlayingXiState = (teamPool, playingXiState) => ({
    teamA: canonicalizePlayingXiNames(
      teamPool?.teamAPlayers || [],
      playingXiState?.teamA || [],
    ),
    teamB: canonicalizePlayingXiNames(
      teamPool?.teamBPlayers || [],
      playingXiState?.teamB || [],
    ),
  })

  const getTeamPlayersBySide = (side) =>
    side === 'teamA'
      ? manualTeamPool?.teamAPlayers || []
      : manualTeamPool?.teamBPlayers || []

  const selectPanel = useCallback((nextPanel) => {
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
  }, [location.pathname, location.search, navigate])

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

  const refreshManualStatsState = async ({
    teamAPlayers = [],
    teamBPlayers = [],
  }) => {
    try {
      const savedScore = await fetchAdminMatchScores({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
      })
      applyManualStatsFromSavedScore({ teamAPlayers, teamBPlayers, savedScore })
    } catch {
      applyManualStatsFromSavedScore({ teamAPlayers, teamBPlayers, savedScore: null })
    }
  }

  const reloadManualTeamPool = useCallback(
    async ({ tournamentId = manualTournamentId, matchId = manualMatchId } = {}) => {
      if (!tournamentId || !matchId) return null
      const [data, savedScore] = await Promise.all([
        fetchTeamPool({
          contestId: undefined,
          tournamentId,
          matchId,
        }),
        fetchAdminMatchScores({
          tournamentId,
          matchId,
        }).catch(() => null),
      ])
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
      setManualPlayingXi({
        teamA:
          data?.teams?.teamA?.lineup?.playingXI?.length >= 11
            ? canonicalizePlayingXiNames(teamAPlayers, data.teams.teamA.lineup.playingXI)
            : [],
        teamB:
          data?.teams?.teamB?.lineup?.playingXI?.length >= 11
            ? canonicalizePlayingXiNames(teamBPlayers, data.teams.teamB.lineup.playingXI)
            : [],
      })
      setManualPlayerStats(
        buildManualStatsState(
          [...teamAPlayers, ...teamBPlayers],
          savedScore?.playerStats || [],
        ),
      )
      return { teamAPlayers, teamBPlayers, nextTeamPool, savedScore }
    },
    [manualMatchId, manualTournamentId],
  )

  useEffect(() => {
    const nextPanel = requestedPanel || defaultPanel
    setActivePanel((prev) => (prev === nextPanel ? prev : nextPanel))
  }, [defaultPanel, requestedPanel])

  useEffect(() => {
    const aliasedPanel = panelAliases[activePanel]
    if (aliasedPanel) {
      selectPanel(aliasedPanel)
    }
  }, [activePanel, panelAliases, selectPanel])

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
        const fixedRosterPublicContests = (allContestsRes || []).filter(
          (contest) => (contest?.mode || '').toString().toLowerCase() === 'fixed_roster',
        )
        const toDashboardContests = (joinedRows = [], publicAuctionRows = []) => {
          const byId = new Map()
          ;(joinedRows || []).forEach((contest) => {
            byId.set(String(contest.id), contest)
          })
          ;(publicAuctionRows || []).forEach((contest) => {
            const id = String(contest.id)
            byId.set(id, { ...contest, ...(byId.get(id) || {}) })
          })
          return Array.from(byId.values())
        }
        const joinedFromAll = (allContestsRes || []).filter(
          (contest) => contest?.joined || contest?.hasTeam,
        )
        setPageLoadData({
          tournaments: data?.tournaments || [],
          joinedContests:
            mergedJoinedFromEndpoint.length > 0
              ? toDashboardContests(mergedJoinedFromEndpoint, fixedRosterPublicContests)
              : toDashboardContests(joinedFromAll, fixedRosterPublicContests),
          pointsRuleTemplate: normalizePointsRuleTemplate(data?.pointsRuleTemplate),
          adminManager: data?.adminManager || [],
          masterConsole: data?.masterConsole || [],
          auditLogs: data?.auditLogs || [],
        })
        setPointsRules(normalizePointsRuleTemplate(data?.pointsRuleTemplate))
        setAllContests(allContestsRes || [])
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
    if (!shouldLoadManualScoreContext) return undefined
    let active = true
    const loadManualContext = async () => {
      try {
        const data = await fetchManualScoreContext()
        if (!active) return
        const tournaments = data?.tournaments || []
        setManualScoreContext((prev) => ({ ...prev, tournaments }))
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
  }, [manualTournamentId, shouldLoadManualScoreContext])

  useEffect(() => {
    if (!shouldLoadManualScoreContext) {
      setManualScoreContext((prev) => ({ ...prev, matches: [] }))
      return undefined
    }
    if (!manualTournamentId) {
      setManualScoreContext((prev) => ({ ...prev, matches: [] }))
      return undefined
    }

    let active = true
    const loadTournamentMatches = async () => {
      try {
        const matches = await fetchTournamentMatches(manualTournamentId)
        if (!active) return
        setManualScoreContext((prev) => ({ ...prev, matches: matches || [] }))
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
  }, [manualTournamentId, shouldLoadManualScoreContext])

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

    let active = true
    const loadTeamPool = async () => {
      try {
        setIsLoadingManualPool(true)
        const result = await reloadManualTeamPool({
          tournamentId: manualTournamentId,
          matchId: manualMatchId,
        })
        if (!active) return
        void result
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
  }, [manualMatchId, manualTournamentId, reloadManualTeamPool])

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
        const groupKey =
          (contest?.mode || '').toString().toLowerCase() === 'fixed_roster'
            ? 'Auction'
            : contest.game || 'Fantasy'
        if (!acc[groupKey]) acc[groupKey] = []
        acc[groupKey].push(contest)
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
  }, [activePanel, selectPanel, validPanelKeys])

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

      const { parsed, normalizedText } = parseNormalizedJsonInput(
        uploadPayloadText || '{}',
      )
      const hasScorePayload =
        Array.isArray(parsed?.playerStats) || Array.isArray(parsed?.scores)
      const hasLineupPayload =
        !!parsed?.lineups && typeof parsed.lineups === 'object' && !Array.isArray(parsed.lineups)
      if (!hasScorePayload && hasLineupPayload) {
        setErrorText(
          'This looks like Playing XI JSON. Switch to Scorecards > Scorecard JSON and retry.',
        )
        return
      }
      const playerStats = Array.isArray(parsed?.playerStats) ? parsed.playerStats : []
      const knownPlayers = [
        ...(manualTeamPool?.teamAPlayers || []),
        ...(manualTeamPool?.teamBPlayers || []),
      ]
      const knownById = new Set(
        knownPlayers.map((player) => String(player.id || '').trim()),
      )
      const knownNames = knownPlayers.map((player) => String(player.name || '').trim())
      const buildSuggestions = (needle) => {
        return buildNameSuggestions(needle, knownNames)
      }
      const unmatchedDetails = playerStats
        .map((row) => {
          const rawId = String(row?.playerId || '').trim()
          if (rawId && knownById.has(rawId)) return null
          const inputName = String(row?.playerName || row?.name || '').trim()
          const resolvedByName = resolveKnownPlayerByName(knownPlayers, inputName)
          if (resolvedByName?.id != null) return null
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
        setErrorText(buildScoreUnmappedErrorMessage(unmatchedDetails))
        return
      }

      const playersById = new Map(
        knownPlayers.map((player) => [String(player?.id || '').trim(), player]),
      )
      const resolvedPlayerStats = playerStats.map((row) => {
        const rawId = String(row?.playerId || '').trim()
        const inputName = String(row?.playerName || row?.name || '').trim()
        const byId = rawId ? playersById.get(rawId) : null
        const resolved = byId || resolveKnownPlayerByName(knownPlayers, inputName)
        return {
          ...row,
          playerId: String(resolved?.id || rawId || '').trim(),
          playerName: String(resolved?.name || inputName || '').trim(),
        }
      })
      const normalizedPayload = {
        ...(parsed || {}),
        playerStats: resolvedPlayerStats,
      }
      const formattedPayloadText = JSON.stringify(normalizedPayload, null, 2)
      if (
        normalizedText !== uploadPayloadText ||
        formattedPayloadText !== uploadPayloadText
      ) {
        setUploadPayloadText(formattedPayloadText)
      }

      const effectiveContestId =
        manualContestId ||
        filteredManualContests.find((item) => item.tournamentId === manualTournamentId)
          ?.id ||
        ''
      setIsSavingScores(true)
      const response = await saveMatchScores({
        payloadText: formattedPayloadText,
        fileName: '',
        processedPayload: null,
        dryRun: true,
        source: 'json',
        tournamentId: manualTournamentId,
        contestId: effectiveContestId,
        matchId: manualMatchId,
        userId: currentUser?.id || currentUser?.userId || '',
      })
      setScorePreviewPayload(response?.processedPayload || { playerStats: resolvedPlayerStats })
      setIsScorePreviewOpen(true)
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

  const onCloseScorePreview = () => {
    if (isSavingScores) return
    setIsScorePreviewOpen(false)
    setScorePreviewPayload(null)
  }

  const onConfirmScorePreviewSave = async () => {
    try {
      if (!manualTournamentId || !manualMatchId || !scorePreviewPayload) return
      setSaveNotice('')
      setErrorText('')
      setIsSavingScores(true)
      const effectiveContestId =
        manualContestId ||
        filteredManualContests.find((item) => item.tournamentId === manualTournamentId)
          ?.id ||
        ''
      const response = await saveMatchScores({
        payloadText: JSON.stringify(scorePreviewPayload, null, 2),
        fileName: '',
        processedPayload: scorePreviewPayload,
        dryRun: false,
        source: 'json',
        tournamentId: manualTournamentId,
        contestId: effectiveContestId,
        matchId: manualMatchId,
        userId: currentUser?.id || currentUser?.userId || '',
      })
      const impacted = Number(response?.impactedContests || 0)
      const updatedAt = response?.lastScoreUpdatedAt
        ? new Date(response.lastScoreUpdatedAt).toLocaleString()
        : 'now'
      setSaveNotice(
        `Match scores payload saved • ${impacted} contests updated • ${updatedAt}`,
      )
      if (response?.savedScore && typeof response.savedScore === 'object') {
        applyManualStatsFromSavedScore({
          teamAPlayers: manualTeamPool.teamAPlayers,
          teamBPlayers: manualTeamPool.teamBPlayers,
          savedScore: response.savedScore,
        })
      }
      const refreshedMatches = await fetchTournamentMatches(manualTournamentId)
      setManualScoreContext((prev) => ({ ...prev, matches: refreshedMatches || [] }))
      await refreshManualStatsState({
        teamAPlayers: manualTeamPool.teamAPlayers,
        teamBPlayers: manualTeamPool.teamBPlayers,
      })
      setUploadPayloadText('')
      setIsScorePreviewOpen(false)
      setScorePreviewPayload(null)
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

    const resolveTeamRows = (players = [], selectedNames = []) => {
      const knownNames = (players || [])
        .map((player) => String(player?.name || '').trim())
        .filter(Boolean)
      const resolved = []
      const missing = []
      ;(selectedNames || []).forEach((name) => {
        const match = resolveKnownPlayerByName(players, name)
        if (!match) {
          missing.push({
            name,
            suggestions: buildNameSuggestions(name, knownNames),
          })
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
    const unresolvedDetails = [...resolvedTeamA.missing, ...resolvedTeamB.missing]
    if (unresolvedDetails.length > 0) {
      const unresolvedNames = unresolvedDetails.map((item) => item.name)
      const hints = unresolvedDetails
        .slice(0, 3)
        .map((item) =>
          item.suggestions?.length
            ? `${item.name} (try: ${item.suggestions.join(' / ')})`
            : item.name,
        )
        .join(', ')
      setErrorText(
        `Playing XI has unmapped players: ${hints || unresolvedNames.join(', ')}. Re-save Playing XI and retry.`,
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
      hatTrick: 0,
      dismissed: false,
    })

    const generated = {
      playerStats: [...resolvedTeamA.resolved, ...resolvedTeamB.resolved].map(buildRow),
    }
    const payloadText = JSON.stringify(generated, null, 2)
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
      const players = getTeamPlayersBySide(side)
      const resolvedPlayer = resolveKnownPlayerByName(players, playerName)
      const nextPlayerName = String(resolvedPlayer?.name || playerName || '').trim()
      const nextPlayerKey = normalizeLooseKey(nextPlayerName)
      const current = canonicalizePlayingXiNames(players, prev?.[side] || [])
      const currentKeys = new Set(current.map((item) => normalizeLooseKey(item)))
      const exists = currentKeys.has(nextPlayerKey)
      if (exists) {
        return {
          ...prev,
          [side]: current.filter(
            (item) => normalizeLooseKey(item) !== nextPlayerKey,
          ),
        }
      }
      if (current.length >= 12) return prev
      return {
        ...prev,
        [side]: [...current, nextPlayerName],
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
        const selectedKeys = new Set(
          canonicalizePlayingXiNames(players, selectedNames).map((name) =>
            normalizeLooseKey(name),
          ),
        )
        const playingXI = squad.filter((name) => selectedKeys.has(normalizeLooseKey(name)))
        return {
          squad,
          playingXI,
          bench: squad.filter((name) => !selectedKeys.has(normalizeLooseKey(name))),
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
      await reloadManualTeamPool({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
      })
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
      setLineupJsonUnmatchedDetails([])
      setIsSavingScores(true)
      const { parsed, normalizedText } = parseNormalizedJsonInput(
        lineupPayloadText || '{}',
      )
      const hasScorePayload =
        Array.isArray(parsed?.playerStats) || Array.isArray(parsed?.scores)
      const hasLineupPayload =
        !!parsed?.lineups && typeof parsed.lineups === 'object' && !Array.isArray(parsed.lineups)
      if (hasScorePayload && !hasLineupPayload) {
        setErrorText(
          'This looks like Scorecard JSON. Switch to Playing XI > Playing XI JSON and retry.',
        )
        return
      }
      if (normalizedText !== lineupPayloadText) {
        setLineupPayloadText(JSON.stringify(parsed, null, 2))
      }
      const lineups =
        parsed?.lineups && typeof parsed.lineups === 'object' ? parsed.lineups : parsed
      const normalizedLineups = {}
      let unmatched = []
      Object.entries(lineups || {}).forEach(([teamName, teamPayload]) => {
        const resolvedTeam = resolveTeamPlayersForInput(teamName)
        if (!resolvedTeam?.key) {
          unmatched.push({
            team: teamName || '-',
            field: 'team',
            input: teamName || '-',
            suggestions: [
              manualTeamPool?.teamAName || '',
              manualTeamPool?.teamBName || '',
            ].filter(Boolean),
          })
          return
        }
        const result = normalizeLineupTeamPayload(
          teamPayload,
          resolvedTeam.players,
          resolvedTeam.key || teamName,
        )
        normalizedLineups[resolvedTeam.key || teamName] = result.normalized
        unmatched = unmatched.concat(result.unmatched)
      })
      if (unmatched.length > 0) {
        setLineupJsonUnmatchedDetails(unmatched)
        setErrorText(buildLineupUnmappedErrorMessage(unmatched))
        return
      }
      const response = await upsertMatchLineups({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
        updatedBy:
          currentUser?.gameName || currentUser?.email || currentUser?.id || 'admin',
        source: 'json-lineup',
        dryRun: true,
        strictSquad: false,
        lineups: normalizedLineups,
        meta: parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta : {},
      })
      setLineupPreviewPayload(response?.saved?.lineups || {})
      setIsLineupPreviewOpen(true)
      setLineupJsonUnmatchedDetails([])
    } catch (error) {
      setLineupJsonUnmatchedDetails([])
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
        canonicalizePlayingXiNames(players, selected).map((name) =>
          normalizeLooseKey(name),
        ),
      )
      const playingXI = squad
        .filter((name) => selectedSet.has(normalizeLooseKey(name)))
        .slice(0, 12)
      return { playingXI }
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
      setLineupJsonUnmatchedDetails([])
      const lineupsToSave = {}
      let unmatched = []
      Object.entries(lineupPreviewPayload || {}).forEach(([teamName, teamPayload]) => {
        const resolvedTeam = resolveTeamPlayersForInput(teamName)
        if (!resolvedTeam?.key) {
          unmatched.push({
            team: teamName || '-',
            field: 'team',
            input: teamName || '-',
            suggestions: [
              manualTeamPool?.teamAName || '',
              manualTeamPool?.teamBName || '',
            ].filter(Boolean),
          })
          return
        }
        const result = normalizeLineupTeamPayload(
          teamPayload,
          resolvedTeam.players,
          resolvedTeam.key || teamName,
        )
        lineupsToSave[resolvedTeam.key || teamName] = result.normalized
        unmatched = unmatched.concat(result.unmatched)
      })
      if (unmatched.length > 0) {
        setLineupJsonUnmatchedDetails(unmatched)
        setErrorText(buildLineupUnmappedErrorMessage(unmatched))
        return
      }
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
      const nextPlayingXi = canonicalizePlayingXiState(manualTeamPool, {
        teamA: saved[manualTeamPool.teamAName]?.playingXI || manualPlayingXi.teamA,
        teamB: saved[manualTeamPool.teamBName]?.playingXI || manualPlayingXi.teamB,
      })
      setManualPlayingXi(nextPlayingXi)
      setSaveNotice('Playing XI JSON saved')
      setLineupPayloadText('')
      setLineupJsonUnmatchedDetails([])
      setLineupPreviewPayload(null)
      setIsLineupPreviewOpen(false)
    } catch (error) {
      setLineupJsonUnmatchedDetails([])
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
        userId: currentUser?.id || currentUser?.userId || '',
        playerStats: rows,
        teamScore: {},
      })
      const impacted = Number(response?.impactedContests || 0)
      const updatedAt = response?.lastScoreUpdatedAt
        ? new Date(response.lastScoreUpdatedAt).toLocaleString()
        : 'now'
      setSaveNotice(`Manual scores saved • ${impacted} contests updated • ${updatedAt}`)
      if (response?.savedScore && typeof response.savedScore === 'object') {
        applyManualStatsFromSavedScore({
          teamAPlayers: manualTeamPool.teamAPlayers,
          teamBPlayers: manualTeamPool.teamBPlayers,
          savedScore: response.savedScore,
        })
      } else {
        await refreshManualStatsState({
          teamAPlayers: manualTeamPool.teamAPlayers,
          teamBPlayers: manualTeamPool.teamBPlayers,
        })
      }
      await reloadManualTeamPool({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
      })
      const refreshedMatches = await fetchTournamentMatches(manualTournamentId)
      setManualScoreContext((prev) => ({ ...prev, matches: refreshedMatches || [] }))
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
        userId: currentUser?.id || currentUser?.userId || '',
      })

      const impacted = Number(response?.impactedContests || 0)
      setSaveNotice(`Match scores reset • ${impacted} contests updated`)

      const refreshedMatches = await fetchTournamentMatches(manualTournamentId)
      setManualScoreContext((prev) => ({ ...prev, matches: refreshedMatches || [] }))
      await reloadManualTeamPool({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
      })
    } catch (error) {
      setErrorText(error.message || 'Failed to reset match scores')
    } finally {
      setIsSavingScores(false)
    }
  }

  const onMarkSelectedMatchComplete = async () => {
    try {
      if (!manualMatchId) return
      const selectedMatch = (manualScoreContext.matches || []).find(
        (row) => String(row.id) === String(manualMatchId),
      )
      if (!selectedMatch?.scoresUpdated) {
        setErrorText('Save match scores first, then mark this match as complete.')
        return
      }
      setSaveNotice('')
      setErrorText('')
      setIsSavingScores(true)
      await updateAdminMatchStatus({ id: manualMatchId, status: 'completed' })
      const refreshedMatches = await fetchTournamentMatches(manualTournamentId)
      setManualScoreContext((prev) => ({ ...prev, matches: refreshedMatches || [] }))
      setSaveNotice('Match marked as completed')
    } catch (error) {
      setErrorText(error.message || 'Failed to mark match as complete')
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
        lineupJsonUnmatchedDetails={lineupJsonUnmatchedDetails}
        lineupPayloadText={lineupPayloadText}
        setLineupPayloadText={setLineupPayloadText}
        manualScoreContext={manualScoreContext}
        manualTournamentId={manualTournamentId}
        setManualTournamentId={setManualTournamentId}
        manualMatchId={manualMatchId}
        setManualMatchId={setManualMatchId}
        manualTeamPool={manualTeamPool}
        manualPlayerStats={manualPlayerStats}
        pointsRules={pointsRules}
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
        onManualStatChange={onManualStatChange}
        onSaveManualScores={onSaveManualScores}
        onResetManualScores={onResetManualScores}
        onMarkSelectedMatchComplete={onMarkSelectedMatchComplete}
        isLoadingManualPool={isLoadingManualPool}
        onSaveScores={onSaveScores}
        onGenerateScoreJson={onGenerateScoreJson}
        isGeneratedScoreJsonOpen={isGeneratedScoreJsonOpen}
        generatedScoreJsonText={generatedScoreJsonText}
        onCloseGeneratedScoreJson={onCloseGeneratedScoreJson}
        isScorePreviewOpen={isScorePreviewOpen}
        scorePreviewPayload={scorePreviewPayload}
        onCloseScorePreview={onCloseScorePreview}
        onConfirmScorePreviewSave={onConfirmScorePreviewSave}
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
        lineupJsonUnmatchedDetails={lineupJsonUnmatchedDetails}
        lineupPayloadText={lineupPayloadText}
        setLineupPayloadText={setLineupPayloadText}
        manualScoreContext={manualScoreContext}
        manualTournamentId={manualTournamentId}
        setManualTournamentId={setManualTournamentId}
        manualMatchId={manualMatchId}
        setManualMatchId={setManualMatchId}
        manualTeamPool={manualTeamPool}
        manualPlayerStats={manualPlayerStats}
        pointsRules={pointsRules}
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
        onManualStatChange={onManualStatChange}
        onSaveManualScores={onSaveManualScores}
        onResetManualScores={onResetManualScores}
        onMarkSelectedMatchComplete={onMarkSelectedMatchComplete}
        isLoadingManualPool={isLoadingManualPool}
        onSaveScores={onSaveScores}
        onGenerateScoreJson={onGenerateScoreJson}
        isGeneratedScoreJsonOpen={isGeneratedScoreJsonOpen}
        generatedScoreJsonText={generatedScoreJsonText}
        onCloseGeneratedScoreJson={onCloseGeneratedScoreJson}
        isScorePreviewOpen={isScorePreviewOpen}
        scorePreviewPayload={scorePreviewPayload}
        onCloseScorePreview={onCloseScorePreview}
        onConfirmScorePreviewSave={onConfirmScorePreviewSave}
        isSavingScores={isSavingScores}
      />
    ),
    audit: (
      <AuditLogsPanel
        rows={infoPanelMap.audit || []}
        tournaments={pageLoadData.tournaments}
      />
    ),
    pendingRemovals: <PendingRemovalsPanel />,
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
