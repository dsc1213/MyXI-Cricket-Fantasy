import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ApiFailureTile from '../components/ui/ApiFailureTile.jsx'
import {
  fetchContests,
  fetchManualScoreContext,
  fetchTeamPool,
  fetchDashboardPageLoadData,
  processExcelMatchScores,
  saveMatchScores,
  saveScoringRules,
  upsertManualMatchScores,
} from '../lib/api.js'
import AdminManagerPanel from './dashboard/AdminManagerPanel.jsx'
import AuditLogsPanel from './dashboard/AuditLogsPanel.jsx'
import CreateTournamentPanel from './dashboard/CreateTournamentPanel.jsx'
import JoinedPanel from './dashboard/JoinedPanel.jsx'
import PointsPanel from './dashboard/PointsPanel.jsx'
import PendingApprovalsPanel from './dashboard/PendingApprovalsPanel.jsx'
import SquadManagerPanel from './dashboard/SquadManagerPanel.jsx'
import UploadPanel from './dashboard/UploadPanel.jsx'
import {
  adminMenuItems,
  masterMenuItems,
  regularMenuItems,
  sectionTitles,
} from './dashboard/constants.js'
import { getStoredUser } from '../lib/auth.js'

const defaultPointsRules = {
  batting: [],
  bowling: [],
  fielding: [],
}

const buildFallbackBootstrap = () => ({
  tournaments: [],
  joinedContests: [],
  pointsRuleTemplate: defaultPointsRules,
  adminManager: [],
  masterConsole: [],
  auditLogs: [],
})

function Dashboard({ defaultPanel = 'joined' }) {
  const [activePanel, setActivePanel] = useState(defaultPanel)
  const [selectedTournament, setSelectedTournament] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [uploadTab, setUploadTab] = useState('manual')
  const [allContests, setAllContests] = useState([])
  const [manualGameType, setManualGameType] = useState('Fantasy')
  const [manualContestId, setManualContestId] = useState('')
  const [manualTeamPool, setManualTeamPool] = useState({
    teamAName: 'Team A',
    teamBName: 'Team B',
    teamAPlayers: [],
    teamBPlayers: [],
  })
  const [manualPlayerStats, setManualPlayerStats] = useState({})
  const [isLoadingManualPool, setIsLoadingManualPool] = useState(false)
  const [manualScoreContext, setManualScoreContext] = useState({
    tournaments: [],
    matches: [],
  })
  const [manualTournamentId, setManualTournamentId] = useState('')
  const [manualMatchId, setManualMatchId] = useState('')
  const [uploadFileName, setUploadFileName] = useState('No file selected')
  const [uploadPayloadText, setUploadPayloadText] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessingExcel, setIsProcessingExcel] = useState(false)
  const [excelPreviewRows, setExcelPreviewRows] = useState([])
  const [excelPreviewMeta, setExcelPreviewMeta] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingRules, setIsSavingRules] = useState(false)
  const [isRulesEditEnabled, setIsRulesEditEnabled] = useState(false)
  const [isSavingScores, setIsSavingScores] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const [pageLoadData, setPageLoadData] = useState(buildFallbackBootstrap)
  const [pointsRules, setPointsRules] = useState(defaultPointsRules)
  const currentUser = getStoredUser()
  const currentUserId = currentUser?.userId || currentUser?.gameName || currentUser?.email || ''

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
          pointsRuleTemplate: data?.pointsRuleTemplate || defaultPointsRules,
          adminManager: data?.adminManager || [],
          masterConsole: data?.masterConsole || [],
          auditLogs: data?.auditLogs || [],
        })
        setPointsRules(data?.pointsRuleTemplate || defaultPointsRules)
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
    setExcelPreviewRows([])
    setExcelPreviewMeta(null)
  }, [uploadFileName])

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

  const manualGameOptions = useMemo(
    () => Array.from(new Set((allContests || []).map((item) => item.game).filter(Boolean))),
    [allContests],
  )

  useEffect(() => {
    if (!manualGameOptions.length) return
    if (!manualGameOptions.includes(manualGameType)) {
      setManualGameType(manualGameOptions[0])
    }
  }, [manualGameOptions, manualGameType])

  const filteredManualContests = useMemo(() => {
    const contestManagerScopeId =
      currentUser?.role === 'contest_manager'
        ? currentUser?.contestManagerContestId || ''
        : ''
    return (allContests || []).filter((contest) => {
      const gameOk = !manualGameType || contest.game === manualGameType
      const tournamentOk = !manualTournamentId || contest.tournamentId === manualTournamentId
      const scopeOk = !contestManagerScopeId || contest.id === contestManagerScopeId
      return gameOk && tournamentOk && scopeOk
    })
  }, [allContests, manualGameType, manualTournamentId, currentUser])

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
      })
      setManualPlayerStats({})
      return
    }
    let active = true
    const loadTeamPool = async () => {
      try {
        setIsLoadingManualPool(true)
        const data = await fetchTeamPool({
          contestId: manualContestId,
          tournamentId: manualTournamentId,
          matchId: manualMatchId,
        })
        if (!active) return
        const teamAPlayers = data?.teams?.teamA?.players || []
        const teamBPlayers = data?.teams?.teamB?.players || []
        setManualTeamPool({
          teamAName: data?.teams?.teamA?.name || 'Team A',
          teamBName: data?.teams?.teamB?.name || 'Team B',
          teamAPlayers,
          teamBPlayers,
        })
        const next = {}
        ;[...teamAPlayers, ...teamBPlayers].forEach((player) => {
          next[player.id] = {
            runs: 0,
            fours: 0,
            sixes: 0,
            wickets: 0,
            maidens: 0,
            wides: 0,
            catches: 0,
            stumpings: 0,
            runoutDirect: 0,
            runoutIndirect: 0,
            dismissed: false,
          }
        })
        setManualPlayerStats(next)
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
  const visibleAdminMenuItems = useMemo(
    () => {
      if (!showAdminTools) return []
      if (currentUser?.role === 'contest_manager') {
        return adminMenuItems.filter((item) => item.key === 'upload')
      }
      return adminMenuItems
    },
    [currentUser?.role, showAdminTools],
  )
  const visibleMenuItems = useMemo(
    () => [
      ...regularMenuItems,
      ...visibleAdminMenuItems,
      ...(showMasterTools ? masterMenuItems : []),
    ],
    [showMasterTools, visibleAdminMenuItems],
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
      setActivePanel('joined')
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
      await saveScoringRules(pointsRules)
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
      const isExcelTab = uploadTab === 'excel'
      const effectiveContestId =
        manualContestId ||
        filteredManualContests.find((item) => item.tournamentId === manualTournamentId)?.id ||
        ''
      const response = await saveMatchScores({
        payloadText: isExcelTab ? '' : uploadPayloadText,
        fileName: uploadFileName !== 'No file selected' ? uploadFileName : '',
        processedPayload: isExcelTab ? { playerStats: excelPreviewRows } : null,
        source: isExcelTab ? 'excel' : 'json',
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
        `${isExcelTab ? 'Excel match scores saved' : 'Match scores payload saved'} • ${impacted} contests updated • ${updatedAt}`,
      )
    } catch (error) {
      setErrorText(error.message || 'Failed to save match scores')
    } finally {
      setIsSavingScores(false)
    }
  }

  const onProcessExcel = async () => {
    try {
      setSaveNotice('')
      setErrorText('')
      setIsProcessingExcel(true)
      const data = await processExcelMatchScores({
        fileName: uploadFileName !== 'No file selected' ? uploadFileName : '',
      })
      const rows = data?.playerStats || []
      setExcelPreviewRows(rows)
      setExcelPreviewMeta({
        fileName: data?.fileName || uploadFileName,
        processedRows: rows.length,
      })
      setSaveNotice('Excel processed. Review preview, then save.')
    } catch (error) {
      setErrorText(error.message || 'Failed to process excel file')
    } finally {
      setIsProcessingExcel(false)
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
        filteredManualContests.find((item) => item.tournamentId === manualTournamentId)?.id ||
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
    } catch (error) {
      setErrorText(error.message || 'Failed to save manual scores')
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
    createTournament: <CreateTournamentPanel onCreated={() => setActivePanel('admin')} />,
    squads: <SquadManagerPanel />,
    admin: <AdminManagerPanel />,
    upload: (
      <UploadPanel
        uploadTab={uploadTab}
        setUploadTab={setUploadTab}
        manualGameType={manualGameType}
        setManualGameType={setManualGameType}
        uploadPayloadText={uploadPayloadText}
        setUploadPayloadText={setUploadPayloadText}
        manualScoreContext={manualScoreContext}
        manualTournamentId={manualTournamentId}
        setManualTournamentId={setManualTournamentId}
        manualMatchId={manualMatchId}
        setManualMatchId={setManualMatchId}
        manualGameOptions={manualGameOptions}
        manualTeamPool={manualTeamPool}
        manualPlayerStats={manualPlayerStats}
        onManualStatChange={onManualStatChange}
        onSaveManualScores={onSaveManualScores}
        isLoadingManualPool={isLoadingManualPool}
        uploadFileName={uploadFileName}
        setUploadFileName={setUploadFileName}
        isDragOver={isDragOver}
        setIsDragOver={setIsDragOver}
        onProcessExcel={onProcessExcel}
        isProcessingExcel={isProcessingExcel}
        excelPreviewRows={excelPreviewRows}
        excelPreviewMeta={excelPreviewMeta}
        onSaveScores={onSaveScores}
        isSavingScores={isSavingScores}
      />
    ),
    audit: (
      <AuditLogsPanel rows={infoPanelMap.audit || []} tournaments={pageLoadData.tournaments} />
    ),
    approvals: <PendingApprovalsPanel />,
  }

  return (
    <section className={`dashboard-shell panel-${activePanel}`.trim()}>
      <aside className="dashboard-left-nav">
        {regularMenuItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`dashboard-nav-btn ${activePanel === item.key ? 'active' : ''}`.trim()}
            onClick={() => setActivePanel(item.key)}
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
                onClick={() => setActivePanel(item.key)}
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
                onClick={() => setActivePanel(item.key)}
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
            value={activePanel}
            onChange={(event) => setActivePanel(event.target.value)}
          >
            <optgroup label="General">
              {regularMenuItems.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </optgroup>
            {showAdminTools && (
              <optgroup label="Admin">
                {visibleAdminMenuItems.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            )}
            {showMasterTools && (
              <optgroup label="Master">
                {masterMenuItems.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {showMasterTools && (
            <div className="top-actions">
              <Link to="/all-pages" className="ghost small">
                All pages
              </Link>
              <Link to="/all-apis" className="ghost small">
                All APIs
              </Link>
            </div>
          )}
        </div>

        <div className="section-head-compact">
          <h2>{sectionTitles[activePanel]}</h2>
          {isLoading && <p className="team-note">Loading dashboard...</p>}
          {!showApiFailureTile && !!errorText && <p className="error-text">{errorText}</p>}
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
