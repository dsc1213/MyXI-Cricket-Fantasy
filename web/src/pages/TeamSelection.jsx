import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PlayerTile from '../components/team-selection/PlayerTile.jsx'
import PreviewModal from '../components/team-selection/PreviewModal.jsx'
import RightColumnContent from '../components/team-selection/RightColumnContent.jsx'
import Button from '../components/ui/Button.jsx'
import CricketRouteLoader from '../components/ui/CricketRouteLoader.jsx'
import Modal from '../components/ui/Modal.jsx'
import { CountryText } from '../components/ui/CountryFlag.jsx'
import { roleCounts } from '../components/team-selection/playerPool.js'
import {
  copyTeamSelection,
  fetchTeamCopySources,
  fetchTeamPool,
  saveTeamSelection,
} from '../lib/api.js'
import {
  sortPlayersByDisplayRole,
  sortPlayersByLastPlayedThenDisplayRole,
} from '../lib/playerRoleSort.js'

const normalizeLineupName = (value = '') => value.toString().trim().toLowerCase()

const buildSelectionRequirementMessage = ({ counts, teamACount, teamBCount, limits }) => {
  if (counts.BAT < limits.minBAT) return `Select at least ${limits.minBAT} batter.`
  if (counts.BOWL < limits.minBOWL) return `Select at least ${limits.minBOWL} bowler.`
  if (counts.WK < limits.minWK) return `Select at least ${limits.minWK} wicketkeeper.`
  if (teamACount < 1 || teamBCount < 1) {
    return 'Select players from both teams.'
  }
  if (teamACount > limits.maxPerTeam || teamBCount > limits.maxPerTeam) {
    return `Select no more than ${limits.maxPerTeam} players from one team.`
  }
  return 'Complete the XI requirements before saving.'
}

function TeamSelection() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') || 'add'
  const isViewMode = mode === 'view'
  const contest = searchParams.get('contest') || ''
  const match = searchParams.get('match') || ''
  const targetUserId = (searchParams.get('userId') || '').toString().trim()
  const [playerPool, setPlayerPool] = useState({
    teamAName: 'Team A',
    teamBName: 'Team B',
    teamAPlayers: [],
    teamBPlayers: [],
  })
  const [contestMeta, setContestMeta] = useState(null)
  const [activeMatch, setActiveMatch] = useState(null)
  const [isLoadingPool, setIsLoadingPool] = useState(false)
  const [poolError, setPoolError] = useState('')
  const [selected, setSelected] = useState([])
  const [backups, setBackups] = useState([])
  const [captainId, setCaptainId] = useState(null)
  const [viceCaptainId, setViceCaptainId] = useState(null)
  const captainIdRef = useRef(null)
  const viceCaptainIdRef = useRef(null)
  const [selectionError, setSelectionError] = useState('')
  const [showSidebar, setShowSidebar] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [copySources, setCopySources] = useState([])
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [isCopyingTeam, setIsCopyingTeam] = useState(false)
  const [hasSavedSelection, setHasSavedSelection] = useState(false)
  const rawUser =
    typeof window !== 'undefined' ? window.localStorage.getItem('myxi-user') : null
  const currentUser = rawUser ? JSON.parse(rawUser) : null
  const actorUserId =
    currentUser?.userId || currentUser?.gameName || currentUser?.email || 'kiran11'
  const isMasterAdmin = currentUser?.role === 'master_admin'
  const isEditingOtherUser = Boolean(targetUserId) && targetUserId !== actorUserId
  const effectiveUserId = isEditingOtherUser && isMasterAdmin ? targetUserId : actorUserId
  const allowLockedEdit = isMasterAdmin && isEditingOtherUser
  const teamAPlayerIds = useMemo(
    () => new Set((playerPool.teamAPlayers || []).map((player) => player.id)),
    [playerPool.teamAPlayers],
  )
  const teamBPlayerIds = useMemo(
    () => new Set((playerPool.teamBPlayers || []).map((player) => player.id)),
    [playerPool.teamBPlayers],
  )
  const sortedTeamAPlayers = useMemo(
    () => sortPlayersByLastPlayedThenDisplayRole(playerPool.teamAPlayers || []),
    [playerPool.teamAPlayers],
  )
  const sortedTeamBPlayers = useMemo(
    () => sortPlayersByLastPlayedThenDisplayRole(playerPool.teamBPlayers || []),
    [playerPool.teamBPlayers],
  )
  const playerById = useMemo(
    () =>
      new Map(
        [...(playerPool.teamAPlayers || []), ...(playerPool.teamBPlayers || [])].map(
          (player) => [String(player.id), player],
        ),
      ),
    [playerPool.teamAPlayers, playerPool.teamBPlayers],
  )

  const syncCaptainId = (value) => {
    const nextValue = value || null
    captainIdRef.current = nextValue
    setCaptainId(nextValue)
  }

  const syncViceCaptainId = (value) => {
    const nextValue = value || null
    viceCaptainIdRef.current = nextValue
    setViceCaptainId(nextValue)
  }

  const resolveSelectedPlayerId = (value) => {
    if (value == null || value === '') return null
    const matched = selected.find((player) => String(player.id) === String(value))
    return matched ? matched.id : value
  }

  useEffect(() => {
    let active = true

    const loadPool = async () => {
      try {
        setIsLoadingPool(true)
        setPoolError('')
        setSaveMessage('')
        if (isEditingOtherUser && !isMasterAdmin) {
          throw new Error('Only master admin can edit another user team')
        }
        const data = await fetchTeamPool({
          contestId: contest,
          matchId: match,
          userId: effectiveUserId,
          actorUserId,
        })
        if (!active) return
        const teamAPlayers = data?.teams?.teamA?.players || []
        const teamBPlayers = data?.teams?.teamB?.players || []
        const mergedPlayers = [...teamAPlayers, ...teamBPlayers]
        const poolById = new Map(
          mergedPlayers.map((player) => [String(player.id), player]),
        )

        setPlayerPool({
          teamAName: data?.teams?.teamA?.name || 'Team A',
          teamBName: data?.teams?.teamB?.name || 'Team B',
          teamAPlayers,
          teamBPlayers,
          teamALineup: data?.teams?.teamA?.lineup || null,
          teamBLineup: data?.teams?.teamB?.lineup || null,
        })
        setContestMeta(data?.contest || null)
        setActiveMatch(data?.activeMatch || null)
        setSelectionError('')
        setCopySources([])

        const savedSelection = data?.selection || null
        setHasSavedSelection(Boolean(savedSelection))
        if (!savedSelection && contest && match && mode !== 'view') {
          fetchTeamCopySources({
            contestId: contest,
            matchId: match,
            userId: effectiveUserId,
          })
            .then((payload) => {
              if (active) setCopySources(Array.isArray(payload?.sources) ? payload.sources : [])
            })
            .catch(() => {
              if (active) setCopySources([])
            })
        }
        if (mode === 'edit' || mode === 'view') {
          let hydratedSelected = []
          let hydratedBackups = []
          const pickedXI = (savedSelection?.playingXi || [])
            .map((id) => poolById.get(String(id)))
            .filter(Boolean)
          const pickedBackups = (savedSelection?.backups || [])
            .map((id) => poolById.get(String(id)))
            .filter(Boolean)
          hydratedSelected = pickedXI.slice(0, 11)
          hydratedBackups = pickedBackups.slice(0, 6)
          syncCaptainId(savedSelection?.captainId || null)
          syncViceCaptainId(savedSelection?.viceCaptainId || null)

          if (!hydratedSelected.length) {
            hydratedSelected = mergedPlayers.slice(0, 11)
            hydratedBackups = mergedPlayers.slice(11, 17)
            syncCaptainId(mergedPlayers[0]?.id || null)
            syncViceCaptainId(mergedPlayers[1]?.id || null)
          }

          setSelected(hydratedSelected)
          setBackups(hydratedBackups)
        } else {
          setSelected([])
          setBackups([])
          syncCaptainId(null)
          syncViceCaptainId(null)
        }
      } catch (error) {
        if (!active) return
        setPoolError(error.message || 'Failed to load player pool')
      } finally {
        if (active) {
          setIsLoadingPool(false)
        }
      }
    }

    loadPool()
    return () => {
      active = false
    }
  }, [
    actorUserId,
    contest,
    effectiveUserId,
    isEditingOtherUser,
    isMasterAdmin,
    match,
    mode,
  ])

  const counts = useMemo(() => roleCounts(selected), [selected])
  const teamACount = selected.filter((p) => teamAPlayerIds.has(p.id)).length
  const teamBCount = selected.filter((p) => teamBPlayerIds.has(p.id)).length
  const isMatchLocked =
    ((activeMatch?.status || '').toString().trim().toLowerCase().replace(/\s+/g, '') ||
      'notstarted') !== 'notstarted'
  const teamALineupPlaying = useMemo(
    () =>
      new Set(
        (playerPool?.teamALineup?.playingXI || []).map((name) =>
          normalizeLineupName(name),
        ),
      ),
    [playerPool?.teamALineup],
  )
  const teamBLineupPlaying = useMemo(
    () =>
      new Set(
        (playerPool?.teamBLineup?.playingXI || []).map((name) =>
          normalizeLineupName(name),
        ),
      ),
    [playerPool?.teamBLineup],
  )

  const limits = {
    minBAT: 1,
    minBOWL: 1,
    minWK: 1,
    maxPerTeam: 8,
    maxXI: 11,
    maxBackups: 6,
  }

  const addPlayer = (player) => {
    if (isViewMode || (isMatchLocked && !isMasterAdmin && !allowLockedEdit)) return
    if (selected.find((p) => p.id === player.id)) return
    if (selected.length >= limits.maxXI) return
    const isTeamA = teamAPlayerIds.has(player.id)
    const isTeamB = teamBPlayerIds.has(player.id)
    if (!isTeamA && !isTeamB) return
    if (isTeamA && teamACount >= limits.maxPerTeam) {
      setSelectionError(`Select no more than ${limits.maxPerTeam} players from one team.`)
      return
    }
    if (isTeamB && teamBCount >= limits.maxPerTeam) {
      setSelectionError(`Select no more than ${limits.maxPerTeam} players from one team.`)
      return
    }

    // Enforce minimum role composition at the final pick itself.
    if (selected.length === limits.maxXI - 1) {
      const nextCounts = roleCounts([...selected, player])
      if (
        nextCounts.BAT < limits.minBAT ||
        nextCounts.BOWL < limits.minBOWL ||
        nextCounts.WK < limits.minWK
      ) {
        setSelectionError(
          buildSelectionRequirementMessage({
            counts: nextCounts,
            teamACount: isTeamA ? teamACount + 1 : teamACount,
            teamBCount: isTeamB ? teamBCount + 1 : teamBCount,
            limits,
          }),
        )
        return
      }
    }

    setSelectionError('')
    setBackups((prev) => prev.filter((p) => p.id !== player.id))
    setSelected((prev) => [...prev, player])
  }

  const removePlayer = (player) => {
    if (isViewMode || (isMatchLocked && !isMasterAdmin && !allowLockedEdit)) return
    if (String(captainIdRef.current) === String(player.id)) syncCaptainId(null)
    if (String(viceCaptainIdRef.current) === String(player.id)) syncViceCaptainId(null)
    setSelectionError('')
    setSelected((prev) => prev.filter((p) => p.id !== player.id))
  }

  const addBackup = (player) => {
    if (isViewMode || (isMatchLocked && !isMasterAdmin && !allowLockedEdit)) return
    if (backups.find((p) => p.id === player.id)) return
    if (selected.find((p) => p.id === player.id)) return
    if (backups.length >= limits.maxBackups) return
    setSelectionError('')
    setBackups((prev) => [...prev, player])
  }

  const removeBackup = (player) => {
    if (isViewMode || (isMatchLocked && !isMasterAdmin && !allowLockedEdit)) return
    setBackups((prev) => prev.filter((p) => p.id !== player.id))
  }

  const isComplete =
    selected.length === limits.maxXI &&
    counts.BAT >= limits.minBAT &&
    counts.BOWL >= limits.minBOWL &&
    counts.WK >= limits.minWK &&
    teamACount >= 1 &&
    teamBCount >= 1 &&
    teamACount <= limits.maxPerTeam &&
    teamBCount <= limits.maxPerTeam
  const roleRequirementMessage =
    selected.length === limits.maxXI &&
    (!captainIdRef.current || !viceCaptainIdRef.current)
      ? 'Captain and vice captain are required before saving.'
      : ''
  const liveSelectionRuleMessage =
    selected.length === limits.maxXI && !isComplete
      ? buildSelectionRequirementMessage({
          counts,
          teamACount,
          teamBCount,
          limits,
        })
      : ''
  const validationMessage =
    selectionError || liveSelectionRuleMessage || roleRequirementMessage
  const previewSaveCountLabel = `${Math.min(selected.length, limits.maxXI)}/${limits.maxXI}`
  const mobileActionValidationMessage =
    validationMessage ||
    (selected.length === limits.maxXI &&
    (!captainIdRef.current || !viceCaptainIdRef.current)
      ? 'Open Preview, choose C and VC, then tap Save Team.'
      : '')

  const backToHref = contestMeta?.tournamentId
    ? `/tournaments/${contestMeta.tournamentId}/contests/${contest}`
    : '/fantasy'
  const backToText = contestMeta?.tournamentId ? 'Back to contest' : 'Back to fantasy'
  const matchSummary = useMemo(() => {
    if (!activeMatch) return ''
    const home = (activeMatch.home || playerPool.teamAName || '').toString().trim()
    const away = (activeMatch.away || playerPool.teamBName || '').toString().trim()
    const venue = (activeMatch.venue || activeMatch.location || '').toString().trim()
    let formattedTime = ''
    if (activeMatch.startAt) {
      const parsed = new Date(activeMatch.startAt)
      if (!Number.isNaN(parsed.getTime())) {
        formattedTime = new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        }).format(parsed)
      }
    }
    return [
      home && away ? `${home} vs ${away}` : '',
      venue,
      formattedTime ? `Starts at: ${formattedTime}` : '',
    ]
      .filter(Boolean)
      .join(' • ')
  }, [activeMatch, playerPool.teamAName, playerPool.teamBName])

  const resolveLineupStatus = (player) => {
    const playerNameKey = normalizeLineupName(player?.name || player?.playerName || '')
    const playingSet = teamAPlayerIds.has(player.id)
      ? teamALineupPlaying
      : teamBLineupPlaying
    if (!playingSet.size) return ''
    return playingSet.has(playerNameKey) ? 'playing' : 'bench'
  }

  const selectedWithLineupStatus = useMemo(
    () =>
      sortPlayersByDisplayRole(
        selected.map((player) => ({
          ...player,
          lineupStatus: resolveLineupStatus(player),
        })),
      ),
    [selected, teamAPlayerIds, teamALineupPlaying, teamBLineupPlaying],
  )
  const backupsWithLineupStatus = useMemo(
    () =>
      backups.map((player) => ({
        ...player,
        lineupStatus: resolveLineupStatus(player),
      })),
    [backups, teamAPlayerIds, teamALineupPlaying, teamBLineupPlaying],
  )

  const onSave = async () => {
    try {
      if (!isComplete) {
        setSelectionError(
          buildSelectionRequirementMessage({
            counts,
            teamACount,
            teamBCount,
            limits,
          }),
        )
        return
      }
      // Allow master admin to save even if match is locked
      if (isMatchLocked && !isMasterAdmin) {
        throw new Error('Match is locked. Teams cannot be edited after start time.')
      }
      const resolvedCaptainId = captainIdRef.current
      const resolvedViceCaptainId = viceCaptainIdRef.current
      if (!resolvedCaptainId || !resolvedViceCaptainId) {
        setSelectionError('Captain and vice captain are required before saving.')
        return
      }
      if (String(resolvedCaptainId) === String(resolvedViceCaptainId)) {
        setSelectionError('Captain and vice captain must be different players.')
        return
      }
      setPoolError('')
      setIsSaving(true)
      setSaveMessage('')
      setSelectionError('')
      if (isEditingOtherUser && !isMasterAdmin) {
        throw new Error('Only master admin can edit another user team')
      }
      await saveTeamSelection({
        contestId: contest,
        matchId: match,
        userId: effectiveUserId,
        actorUserId,
        playingXi: selected.map((player) => player.id),
        backups: backups.map((player) => player.id),
        captainId: resolvedCaptainId,
        viceCaptainId: resolvedViceCaptainId,
      })
      setHasSavedSelection(true)
      setSaveMessage('Team saved')
      navigate(backToHref)
    } catch (error) {
      setPoolError(error.message || 'Failed to save team')
    } finally {
      setIsSaving(false)
    }
  }

  const applyCopiedSelection = (selection = {}) => {
    const copiedXI = (selection.playingXi || [])
      .map((id) => playerById.get(String(id)))
      .filter(Boolean)
      .slice(0, 11)
    const copiedBackups = (selection.backups || [])
      .map((id) => playerById.get(String(id)))
      .filter(Boolean)
      .slice(0, 6)
    setSelected(copiedXI)
    setBackups(copiedBackups)
    syncCaptainId(selection.captainId || null)
    syncViceCaptainId(selection.viceCaptainId || null)
  }

  const onCopyTeam = async (source) => {
    if (!source?.id) return
    try {
      setIsCopyingTeam(true)
      setPoolError('')
      const result = await copyTeamSelection({
        sourceSelectionId: source.id,
        targetContestId: contest,
        matchId: match,
        userId: effectiveUserId,
      })
      applyCopiedSelection(result?.selection || source)
      setHasSavedSelection(true)
      setCopySources([])
      setShowCopyModal(false)
      setSaveMessage('Team copied and saved')
    } catch (error) {
      setPoolError(error.message || 'Failed to copy team')
    } finally {
      setIsCopyingTeam(false)
    }
  }

  const renderRow = (player) => {
    const isSelected = selected.find((p) => p.id === player.id)
    const isBackup = backups.find((p) => p.id === player.id)
    const lineupStatus = resolveLineupStatus(player)

    return (
      <PlayerTile
        key={player.id}
        player={player}
        isSelected={!!isSelected}
        isBackup={!!isBackup}
        lineupStatus={lineupStatus}
        disabled={isViewMode || (isMatchLocked && !isMasterAdmin && !allowLockedEdit)}
        onToggle={() => (isSelected ? removePlayer(player) : addPlayer(player))}
        onBackup={() => (isBackup ? removeBackup(player) : addBackup(player))}
      />
    )
  }

  return (
    <section className="team-shell premium-fit">
      <CricketRouteLoader
        loading={isSaving || isLoadingPool}
        mode={isSaving ? 'hit' : 'bowl'}
        title={isSaving ? 'Saving team...' : 'Loading player pool...'}
        subtitle={isSaving ? 'Finalizing your XI' : 'Fetching squads and saved picks'}
      />
      <div className="team-shell-head">
        <div className="flow-breadcrumb">
          <Link to="/fantasy">Fantasy</Link>
          <span>/</span>
          <strong>
            {mode === 'edit' ? 'Edit Team' : mode === 'view' ? 'View Team' : 'Add Team'}
          </strong>
        </div>
        <Button to={backToHref} variant="ghost" size="small">
          {backToText}
        </Button>
      </div>
      <header className="team-bar">
        <div className="team-bar-left">
          <span className="team-bar-title">Pick your MyXI</span>
          {contest && match && (
            <>
              <span className="team-bar-divider">•</span>
              <span className="team-bar-rules">
                {`Contest: ${contest} | ${match} | ${mode === 'edit' ? 'Edit team' : mode === 'view' ? 'View team' : 'Add team'}`}
              </span>
            </>
          )}
          {isEditingOtherUser && isMasterAdmin && (
            <>
              <span className="team-bar-divider">•</span>
              <span className="team-bar-rules">{`Master edit: ${effectiveUserId}`}</span>
            </>
          )}
          <span className="team-bar-divider">•</span>
          <span className="team-bar-rules">
            Min 1 Bat, 1 Bowl, 1 Wk • Max 8 per team • C 2x • VC 1.5x
          </span>
          {!!matchSummary && (
            <>
              <span className="team-bar-divider">•</span>
              <span className="team-bar-rules">{matchSummary}</span>
            </>
          )}
          {isMatchLocked && (
            <>
              <span className="team-bar-divider">•</span>
              <span className="team-bar-rules">Match locked</span>
            </>
          )}
          {isLoadingPool && (
            <>
              <span className="team-bar-divider">•</span>
              <span className="team-bar-rules">Loading pool...</span>
            </>
          )}
          {!!poolError && (
            <>
              <span className="team-bar-divider">•</span>
              <span className="error-text">{poolError}</span>
            </>
          )}
          {!!saveMessage && (
            <>
              <span className="team-bar-divider">•</span>
              <span className="team-bar-rules">{saveMessage}</span>
            </>
          )}
        </div>
        <div className="team-bar-actions">
          {!isViewMode && (
            <Button
              className="desktop-save"
              variant="primary"
              size="small"
              disabled={
                selected.length !== limits.maxXI ||
                isSaving ||
                (isViewMode ? true : isMasterAdmin ? false : isMatchLocked)
              }
              onClick={onSave}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
          {!!mobileActionValidationMessage && (
            <span className="team-bar-rules show-mobile mobile-preview-hint mobile-save-validation">
              {mobileActionValidationMessage}
            </span>
          )}
          <Button
            variant="ghost"
            size="small"
            className="show-mobile"
            onClick={() => {
              if (
                selected.length === limits.maxXI &&
                (!captainIdRef.current || !viceCaptainIdRef.current)
              ) {
                setSelectionError('Open Preview, choose C and VC, then tap Save Team.')
              }
              setShowSidebar(true)
            }}
          >
            {`☰ Preview & Save (${previewSaveCountLabel})`}
          </Button>
        </div>
      </header>

      {!isViewMode && !hasSavedSelection && copySources.length > 0 ? (
        <div className="copy-team-banner">
          <div>
            <strong>Already picked this match</strong>
            <span>{`${copySources.length} team${copySources.length === 1 ? '' : 's'} available`}</span>
          </div>
          <Button variant="secondary" size="small" onClick={() => setShowCopyModal(true)}>
            Copy team
          </Button>
        </div>
      ) : null}

      <div className="team-grid-2 compact-fit">
        <div className="team-column team-column-a">
          <div className="team-column-header">
            <h3>
              <CountryText value={playerPool.teamAName} />
            </h3>
            <span className="badge light">{sortedTeamAPlayers.length} players</span>
          </div>
          <div className="tile-grid two-col">{sortedTeamAPlayers.map(renderRow)}</div>
        </div>

        <div className="team-column team-column-b">
          <div className="team-column-header">
            <h3>
              <CountryText value={playerPool.teamBName} />
            </h3>
            <span className="badge light">{sortedTeamBPlayers.length} players</span>
          </div>
          <div className="tile-grid two-col">{sortedTeamBPlayers.map(renderRow)}</div>
        </div>

        <aside className="right-column desktop-only">
          <RightColumnContent
            selected={selectedWithLineupStatus}
            counts={counts}
            backups={backupsWithLineupStatus}
            captainId={captainId}
            viceCaptainId={viceCaptainId}
            onCaptainChange={(value) => {
              syncCaptainId(resolveSelectedPlayerId(value))
              setSelectionError('')
            }}
            onViceCaptainChange={(value) => {
              syncViceCaptainId(resolveSelectedPlayerId(value))
              setSelectionError('')
            }}
            validationMessage={validationMessage}
            disabled={isViewMode ? true : isMasterAdmin ? false : isMatchLocked}
          />
        </aside>
      </div>

      <PreviewModal
        open={showSidebar}
        title="MyXI Preview"
        onClose={() => setShowSidebar(false)}
        size="md"
        className="team-preview-modal"
        footer={
          <>
            {!isViewMode && (
              <Button
                variant="primary"
                size="small"
                className="mobile-preview-save"
                disabled={
                  selected.length !== limits.maxXI ||
                  isSaving ||
                  (isViewMode ? true : isMasterAdmin ? false : isMatchLocked)
                }
                onClick={onSave}
              >
                {isSaving ? 'Saving...' : 'Save Team'}
              </Button>
            )}
            <Button variant="ghost" size="small" onClick={() => setShowSidebar(false)}>
              Close
            </Button>
          </>
        }
      >
        <div className="team-preview-column">
          <RightColumnContent
            selected={selectedWithLineupStatus}
            counts={counts}
            backups={backupsWithLineupStatus}
            captainId={captainId}
            viceCaptainId={viceCaptainId}
            onCaptainChange={(value) => {
              syncCaptainId(resolveSelectedPlayerId(value))
              setSelectionError('')
            }}
            onViceCaptainChange={(value) => {
              syncViceCaptainId(resolveSelectedPlayerId(value))
              setSelectionError('')
            }}
            validationMessage={validationMessage}
            disabled={isViewMode ? true : isMasterAdmin ? false : isMatchLocked}
          />
        </div>
      </PreviewModal>
      <Modal
        open={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        title="Copy existing team"
        size="sm"
      >
        <div className="copy-team-source-list">
          {copySources.map((source) => (
            <button
              key={source.id}
              type="button"
              className="copy-team-source-row"
              disabled={isCopyingTeam}
              onClick={() => void onCopyTeam(source)}
            >
              <strong>{source.contestName || `Contest ${source.contestId}`}</strong>
              <span>
                {`${source.playingXi?.length || 0} players · ${source.backups?.length || 0} backups`}
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </section>
  )
}

export default TeamSelection
