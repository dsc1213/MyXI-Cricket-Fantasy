import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ApiFailureTile from '../components/ui/ApiFailureTile.jsx'
import {
  fetchAdminMatchScores,
  fetchContests,
  fetchManualScoreContext,
  fetchTeamPool,
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
    next[targetId] = {
      ...buildDefaultManualStatsRow(),
      ...next[targetId],
      ...row,
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
  const [allContests, setAllContests] = useState([])
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
  const [lineupPayloadText, setLineupPayloadText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingRules, setIsSavingRules] = useState(false)
  const [isRulesEditEnabled, setIsRulesEditEnabled] = useState(false)
  const [isSavingScores, setIsSavingScores] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [pageLoadData, setPageLoadData] = useState(buildFallbackBootstrap)
  const [pointsRules, setPointsRules] = useState(defaultPointsRules)
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
  }

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

  const refreshManualStatsState = async ({
    tournamentId,
    matchId,
    teamAPlayers = [],
    teamBPlayers = [],
  }) => {
    const allPlayers = [...teamAPlayers, ...teamBPlayers]
    try {
      const savedScore = await fetchAdminMatchScores({ tournamentId, matchId })
      setManualPlayerStats(
        buildManualStatsState(allPlayers, savedScore?.playerStats || []),
      )
    } catch {
      setManualPlayerStats(buildManualStatsState(allPlayers, []))
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
    let active = true

    const load = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const [data, contestsRes] = await Promise.all([
          fetchDashboardPageLoadData(),
          fetchContests({ userId: currentUserId }),
        ])
        if (!active) return
        setPageLoadData({
          tournaments: data?.tournaments || [],
          joinedContests: (contestsRes || []).filter((contest) => contest.joined),
          pointsRuleTemplate: normalizePointsRuleTemplate(data?.pointsRuleTemplate),
          adminManager: data?.adminManager || [],
          masterConsole: data?.masterConsole || [],
          auditLogs: data?.auditLogs || [],
        })
        setPointsRules(normalizePointsRuleTemplate(data?.pointsRuleTemplate))
        setAllContests(contestsRes || [])
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
    let active = true
    const loadManualContext = async () => {
      try {
        const data = await fetchManualScoreContext({
          tournamentId: manualTournamentId || undefined,
        })
        if (!active) return
        setManualScoreContext({
          tournaments: data?.tournaments || [],
          matches: data?.matches || [],
        })
        if (!manualTournamentId && data?.selectedTournamentId) {
          setManualTournamentId(data.selectedTournamentId)
        }
        setManualMatchId((prev) => {
          const hasSelectedMatch = (data?.matches || []).some((item) => item.id === prev)
          if ((!prev || !hasSelectedMatch) && data?.matches?.length) {
            return data.matches[0].id
          }
          return prev
        })
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load match score context')
      }
    }
    loadManualContext()
    return () => {
      active = false
    }
  }, [manualTournamentId])

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
    if (!manualContestId || !manualMatchId) {
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
        const [data, savedScore] = await Promise.all([
          fetchTeamPool({
            contestId: manualContestId,
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
        setManualTeamPool({
          teamAName: data?.teams?.teamA?.name || 'Team A',
          teamBName: data?.teams?.teamB?.name || 'Team B',
          teamAPlayers,
          teamBPlayers,
          teamALineup: data?.teams?.teamA?.lineup || null,
          teamBLineup: data?.teams?.teamB?.lineup || null,
        })
        const defaultPlayingA =
          data?.teams?.teamA?.lineup?.playingXI?.length >= 11
            ? data.teams.teamA.lineup.playingXI
            : []
        const defaultPlayingB =
          data?.teams?.teamB?.lineup?.playingXI?.length >= 11
            ? data.teams.teamB.lineup.playingXI
            : []
        setManualPlayingXi({
          teamA: defaultPlayingA,
          teamB: defaultPlayingB,
        })
        setManualPlayerStats(
          buildManualStatsState(
            [...teamAPlayers, ...teamBPlayers],
            savedScore?.playerStats || [],
          ),
        )
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
  }, [manualContestId, manualMatchId, manualTournamentId])

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
      return adminMenuItems.filter((item) => item.key === 'upload')
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
      setSaveNotice('')
      setErrorText('')
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
      setUploadPayloadText('')
      await refreshManualStatsState({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
        teamAPlayers: manualTeamPool.teamAPlayers,
        teamBPlayers: manualTeamPool.teamBPlayers,
      })
    } catch (error) {
      setErrorText(error.message || 'Failed to save match scores')
    } finally {
      setIsSavingScores(false)
    }
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
        strictSquad: false,
        lineups,
        meta: parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta : {},
      })
      const saved = response?.saved?.lineups || {}
      setManualTeamPool((prev) => ({
        ...prev,
        teamALineup: saved[prev.teamAName] || prev.teamALineup,
        teamBLineup: saved[prev.teamBName] || prev.teamBLineup,
      }))
      setManualPlayingXi({
        teamA: saved[manualTeamPool.teamAName]?.playingXI || manualPlayingXi.teamA,
        teamB: saved[manualTeamPool.teamBName]?.playingXI || manualPlayingXi.teamB,
      })
      setSaveNotice('Playing XI JSON saved')
      setLineupPayloadText('')
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
      await refreshManualStatsState({
        tournamentId: manualTournamentId,
        matchId: manualMatchId,
        teamAPlayers: manualTeamPool.teamAPlayers,
        teamBPlayers: manualTeamPool.teamBPlayers,
      })
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
    upload: (
      <UploadPanel
        uploadTab={uploadTab}
        setUploadTab={setUploadTab}
        uploadPayloadText={uploadPayloadText}
        setUploadPayloadText={setUploadPayloadText}
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
        onReplaceManualBackups={onReplaceManualBackups}
        onManualStatChange={onManualStatChange}
        onSaveManualScores={onSaveManualScores}
        onResetManualScores={onResetManualScores}
        isLoadingManualPool={isLoadingManualPool}
        onSaveScores={onSaveScores}
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
          {!!saveNotice && <p className="success-text">{saveNotice}</p>}
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
