import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PlayerTile from '../components/team-selection/PlayerTile.jsx'
import PreviewModal from '../components/team-selection/PreviewModal.jsx'
import RightColumnContent from '../components/team-selection/RightColumnContent.jsx'
import Button from '../components/ui/Button.jsx'
import CricketRouteLoader from '../components/ui/CricketRouteLoader.jsx'
import { CountryText } from '../components/ui/CountryFlag.jsx'
import { roleCounts } from '../components/team-selection/playerPool.js'
import { fetchTeamPool, saveTeamSelection } from '../lib/api.js'

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
  const [isLoadingPool, setIsLoadingPool] = useState(false)
  const [poolError, setPoolError] = useState('')
  const [selected, setSelected] = useState([])
  const [backups, setBackups] = useState([])
  const [showSidebar, setShowSidebar] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const rawUser =
    typeof window !== 'undefined' ? window.localStorage.getItem('myxi-user') : null
  const currentUser = rawUser ? JSON.parse(rawUser) : null
  const actorUserId =
    currentUser?.userId || currentUser?.gameName || currentUser?.email || 'kiran11'
  const isMasterAdmin = currentUser?.role === 'master_admin'
  const isEditingOtherUser = Boolean(targetUserId) && targetUserId !== actorUserId
  const effectiveUserId =
    isEditingOtherUser && isMasterAdmin ? targetUserId : actorUserId
  const teamAPlayerIds = useMemo(
    () => new Set((playerPool.teamAPlayers || []).map((player) => player.id)),
    [playerPool.teamAPlayers],
  )
  const teamBPlayerIds = useMemo(
    () => new Set((playerPool.teamBPlayers || []).map((player) => player.id)),
    [playerPool.teamBPlayers],
  )

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
        const poolById = new Map(mergedPlayers.map((player) => [player.id, player]))

        setPlayerPool({
          teamAName: data?.teams?.teamA?.name || 'Team A',
          teamBName: data?.teams?.teamB?.name || 'Team B',
          teamAPlayers,
          teamBPlayers,
        })
        setContestMeta(data?.contest || null)

        if (mode === 'edit' || mode === 'view') {
          let hydratedSelected = []
          let hydratedBackups = []
          const savedSelection = data?.selection || null
          const pickedXI = (savedSelection?.playingXi || [])
            .map((id) => poolById.get(id))
            .filter(Boolean)
          const pickedBackups = (savedSelection?.backups || [])
            .map((id) => poolById.get(id))
            .filter(Boolean)
          hydratedSelected = pickedXI.slice(0, 11)
          hydratedBackups = pickedBackups.slice(0, 6)

          if (!hydratedSelected.length) {
            hydratedSelected = mergedPlayers.slice(0, 11)
            hydratedBackups = mergedPlayers.slice(11, 17)
          }

          setSelected(hydratedSelected)
          setBackups(hydratedBackups)
        } else {
          setSelected([])
          setBackups([])
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

  const limits = {
    minBAT: 1,
    minBOWL: 1,
    minWK: 1,
    maxPerTeam: 8,
    maxXI: 11,
    maxBackups: 6,
  }

  const addPlayer = (player) => {
    if (isViewMode) return
    if (selected.find((p) => p.id === player.id)) return
    if (selected.length >= limits.maxXI) return
    const isTeamA = teamAPlayerIds.has(player.id)
    const isTeamB = teamBPlayerIds.has(player.id)
    if (!isTeamA && !isTeamB) return
    if (isTeamA && teamACount >= limits.maxPerTeam) return
    if (isTeamB && teamBCount >= limits.maxPerTeam) return
    setSelected((prev) => [...prev, player])
  }

  const removePlayer = (player) => {
    if (isViewMode) return
    setSelected((prev) => prev.filter((p) => p.id !== player.id))
  }

  const addBackup = (player) => {
    if (isViewMode) return
    if (backups.find((p) => p.id === player.id)) return
    if (selected.find((p) => p.id === player.id)) return
    if (backups.length >= limits.maxBackups) return
    setBackups((prev) => [...prev, player])
  }

  const removeBackup = (player) => {
    if (isViewMode) return
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

  const backToHref = contestMeta?.tournamentId
    ? `/tournaments/${contestMeta.tournamentId}/contests/${contest}`
    : '/fantasy'
  const backToText = contestMeta?.tournamentId ? 'Back to contest' : 'Back to fantasy'
  const onSave = async () => {
    try {
      if (!isComplete) return
      setPoolError('')
      setIsSaving(true)
      setSaveMessage('')
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
      })
      setSaveMessage('Team saved')
      navigate(backToHref)
    } catch (error) {
      setPoolError(error.message || 'Failed to save team')
    } finally {
      setIsSaving(false)
    }
  }

  const renderRow = (player) => {
    const isSelected = selected.find((p) => p.id === player.id)
    const isBackup = backups.find((p) => p.id === player.id)

    return (
      <PlayerTile
        key={player.id}
        player={player}
        isSelected={!!isSelected}
        isBackup={!!isBackup}
        disabled={isViewMode}
        onToggle={() => (isSelected ? removePlayer(player) : addPlayer(player))}
        onBackup={() => (isBackup ? removeBackup(player) : addBackup(player))}
      />
    )
  }

  return (
    <section className="team-shell premium-fit">
      <CricketRouteLoader
        loading={isSaving}
        mode="hit"
        title="Saving team..."
        subtitle="Finalizing your XI"
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
          <span className="team-bar-rules">Min 1 Bat, 1 Bowl, 1 Wk • Max 8 per team</span>
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
              variant="primary"
              size="small"
              disabled={!isComplete || isSaving}
              onClick={onSave}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="small"
            className="show-mobile"
            onClick={() => setShowSidebar(true)}
          >
            ☰ Preview
          </Button>
        </div>
      </header>

      <div className="team-grid-2 compact-fit">
        <div className="team-column">
          <div className="team-column-header">
            <h3>
              <CountryText value={playerPool.teamAName} />
            </h3>
            <span className="badge light">{playerPool.teamAPlayers.length} players</span>
          </div>
          <div className="tile-grid two-col">
            {playerPool.teamAPlayers.map(renderRow)}
          </div>
        </div>

        <div className="team-column">
          <div className="team-column-header">
            <h3>
              <CountryText value={playerPool.teamBName} />
            </h3>
            <span className="badge light">{playerPool.teamBPlayers.length} players</span>
          </div>
          <div className="tile-grid two-col">
            {playerPool.teamBPlayers.map(renderRow)}
          </div>
        </div>

        <aside className="right-column desktop-only">
          <RightColumnContent selected={selected} counts={counts} backups={backups} />
        </aside>
      </div>

      <PreviewModal
        open={showSidebar}
        title="MyXI Preview"
        onClose={() => setShowSidebar(false)}
      >
        <RightColumnContent selected={selected} counts={counts} backups={backups} />
      </PreviewModal>
    </section>
  )
}

export default TeamSelection
