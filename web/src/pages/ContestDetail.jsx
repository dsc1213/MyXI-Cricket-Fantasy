import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ResourceRemovalModal from '../components/admin/ResourceRemovalModal.jsx'
import ContestTopBar from '../components/contest-detail/ContestTopBar.jsx'
import CopyTeamModal from '../components/contest-detail/CopyTeamModal.jsx'
import MatchesCard from '../components/contest-detail/MatchesCard.jsx'
import ParticipantsCard from '../components/contest-detail/ParticipantsCard.jsx'
import TeamCompareModal from '../components/contest-detail/TeamCompareModal.jsx'
import {
  buildTeamComparison,
  normalizeCompareTeam,
} from '../components/contest-detail/teamCompare.js'
import TeamPreviewDrawer from '../components/contest-detail/TeamPreviewDrawer.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import StickyTable from '../components/ui/StickyTable.jsx'
import {
  fetchContest,
  fetchContestLeaderboard,
  fetchContestMatches,
  fetchContestParticipants,
  fetchContestRemovalPreview,
  fetchTeamCopySources,
  fetchTeamPool,
  fetchTournaments,
  fetchUserPicks,
  syncLiveScoresNow,
  copyTeamSelection,
  removeAdminContest,
} from '../lib/api.js'
import { getStoredUser } from '../lib/auth.js'
import { getDisplayName } from '../lib/displayName.js'
import { normalizeMatchStatus } from '../lib/matchStatus.js'

const normalizeContestMatches = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.matches)) return payload.matches
  return []
}

const normalizeContestParticipants = (payload) => {
  if (Array.isArray(payload)) {
    return {
      participants: payload,
      joinedCount: payload.length,
      previewXI: [],
      previewBackups: [],
    }
  }
  return {
    participants: Array.isArray(payload?.participants) ? payload.participants : [],
    joinedCount: Number(payload?.joinedCount || 0),
    previewXI: Array.isArray(payload?.previewXI) ? payload.previewXI : [],
    previewBackups: Array.isArray(payload?.previewBackups) ? payload.previewBackups : [],
  }
}

const getMatchStartTime = (match) => {
  const raw = (match?.startAt || match?.startTime || '').toString().trim()
  if (!raw) return Number.POSITIVE_INFINITY
  const parsed = new Date(raw)
  const time = parsed.getTime()
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

const getLocalDayStart = (timestamp) => {
  const day = new Date(timestamp)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

const getMatchDateBucket = (matchStartTime, todayStart) => {
  if (!Number.isFinite(matchStartTime)) return 3
  const matchDayStart = getLocalDayStart(matchStartTime)
  if (matchDayStart === todayStart) return 0
  if (matchDayStart > todayStart) return 1
  return 2
}

const sortContestMatches = (rows = []) =>
  [...rows].sort((left, right) => {
    const todayStart = getLocalDayStart(Date.now())
    const leftStart = getMatchStartTime(left)
    const rightStart = getMatchStartTime(right)
    const leftBucket = getMatchDateBucket(leftStart, todayStart)
    const rightBucket = getMatchDateBucket(rightStart, todayStart)

    if (leftBucket !== rightBucket) {
      return leftBucket - rightBucket
    }

    const timeDiff = leftStart - rightStart
    if (timeDiff !== 0) return timeDiff

    return String(left?.matchNo || left?.id || '').localeCompare(
      String(right?.matchNo || right?.id || ''),
    )
  })

const getDefaultSelectedMatchId = (rows = [], currentSelectedMatchId = '') => {
  const sortedRows = sortContestMatches(rows)
  if (
    currentSelectedMatchId &&
    sortedRows.some((match) => String(match.id) === String(currentSelectedMatchId))
  ) {
    return currentSelectedMatchId
  }
  return sortedRows[0]?.id || ''
}

const getTeamPoolPlayers = (pool = {}) => [
  ...(pool?.teams?.teamA?.players || []),
  ...(pool?.teams?.teamB?.players || []),
]

function ContestDetail() {
  const { tournamentId, contestId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const viewMode = new URLSearchParams(location.search).get('view') || ''
  const currentUser = getStoredUser()
  const isLoggedIn = Boolean(currentUser)
  const currentUserGameName =
    currentUser?.userId || currentUser?.gameName || currentUser?.email || 'kiran11'
  const canEditFullTeams = currentUser?.role === 'master_admin'
  const canSeeMissingTeams = ['admin', 'master_admin'].includes(currentUser?.role)
  const canDeleteContest = ['admin', 'master_admin'].includes(currentUser?.role)
  const [isLoading, setIsLoading] = useState(true)
  const [isLiveSyncing, setIsLiveSyncing] = useState(true)
  const [liveSyncContestId, setLiveSyncContestId] = useState('')
  const [liveSyncRevision, setLiveSyncRevision] = useState(0)
  const [isMetaLoading, setIsMetaLoading] = useState(true)
  const [hasLoadedMatchesOnce, setHasLoadedMatchesOnce] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [contestTitle, setContestTitle] = useState(contestId)
  const [contestMode, setContestMode] = useState('')
  const [tournamentName, setTournamentName] = useState(tournamentId)
  const [lastScoreUpdatedAt, setLastScoreUpdatedAt] = useState('')
  const [lastScoreUpdatedBy, setLastScoreUpdatedBy] = useState('')
  const [lastUpdatedContext, setLastUpdatedContext] = useState('')
  const [matches, setMatches] = useState([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [matchFilter, setMatchFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [participants, setParticipants] = useState([])
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false)
  const [joinedParticipantsCount, setJoinedParticipantsCount] = useState(0)
  const [previewXI, setPreviewXI] = useState([])
  const [previewBackups, setPreviewBackups] = useState([])
  const [previewPlayer, setPreviewPlayer] = useState(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [showLeaderboardPreview, setShowLeaderboardPreview] = useState(false)
  const [leaderboardRows, setLeaderboardRows] = useState([])
  const [isLoadingLeaderboardPreview, setIsLoadingLeaderboardPreview] = useState(false)
  const [leaderboardPreviewError, setLeaderboardPreviewError] = useState('')
  const [showDeleteContestModal, setShowDeleteContestModal] = useState(false)
  const [isRemovingContest, setIsRemovingContest] = useState(false)
  const [copyMatch, setCopyMatch] = useState(null)
  const [copySources, setCopySources] = useState([])
  const [selectedCopySourceId, setSelectedCopySourceId] = useState('')
  const [copyPlayerMap, setCopyPlayerMap] = useState(new Map())
  const [isLoadingCopySources, setIsLoadingCopySources] = useState(false)
  const [isSavingCopiedTeam, setIsSavingCopiedTeam] = useState(false)
  const [copyError, setCopyError] = useState('')
  const [copyableMatchIds, setCopyableMatchIds] = useState(new Set())
  const [comparePlayer, setComparePlayer] = useState(null)
  const [compareData, setCompareData] = useState({
    common: [],
    onlyMine: [],
    onlyTheirs: [],
  })
  const [isLoadingCompare, setIsLoadingCompare] = useState(false)
  const [compareError, setCompareError] = useState('')
  const isLiveSyncReady = !isLiveSyncing && String(liveSyncContestId) === String(contestId)

  useEffect(() => {
    let active = true
    setIsLiveSyncing(true)
    setLiveSyncContestId('')

    const runInitialLiveSync = async () => {
      try {
        await syncLiveScoresNow({ reason: 'contest-page' })
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Live score sync failed')
      } finally {
        if (active) {
          setLiveSyncContestId(contestId)
          setLiveSyncRevision((value) => value + 1)
          setIsLiveSyncing(false)
        }
      }
    }

    runInitialLiveSync()
    return () => {
      active = false
    }
  }, [contestId])

  useEffect(() => {
    if (!isLiveSyncReady) return
    let active = true

    const loadMeta = async () => {
      try {
        setIsMetaLoading(true)
        setErrorText('')
        const [contest, tournaments] = await Promise.all([
          fetchContest(contestId),
          fetchTournaments(),
        ])
        if (!active) return
        setContestTitle(contest.name)
        setContestMode(contest.mode || '')
        setLastScoreUpdatedAt(contest.lastUpdatedAt || contest.lastScoreUpdatedAt || '')
        setLastScoreUpdatedBy(contest.lastUpdatedBy || contest.lastScoreUpdatedBy || '')
        setLastUpdatedContext(contest.lastUpdatedContext || '')
        const tournament = tournaments.find((item) => item.id === tournamentId)
        setTournamentName(tournament?.name || tournamentId)
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load contest')
      } finally {
        if (active) setIsMetaLoading(false)
      }
    }

    loadMeta()
    return () => {
      active = false
    }
  }, [contestId, tournamentId, isLiveSyncReady, liveSyncRevision])

  useEffect(() => {
    setHasLoadedMatchesOnce(false)
    setMatches([])
    setSelectedMatchId('')
    setParticipants([])
    setIsLoadingParticipants(false)
    setJoinedParticipantsCount(0)
    setPreviewXI([])
    setPreviewBackups([])
    setPreviewPlayer(null)
    setIsLoadingPreview(false)
    setLeaderboardRows([])
    setLeaderboardPreviewError('')
    setIsLiveSyncing(true)
    setLiveSyncContestId('')
  }, [contestId])

  useEffect(() => {
    setIsLoading(!isLiveSyncReady || isMetaLoading || !hasLoadedMatchesOnce)
  }, [hasLoadedMatchesOnce, isLiveSyncReady, isMetaLoading])

  useEffect(() => {
    if (!isLiveSyncReady) return
    let active = true

    const loadMatches = async () => {
      try {
        setErrorText('')
        const data = await fetchContestMatches({
          contestId,
          status: matchFilter,
          team: teamFilter,
          userId: currentUserGameName,
        })
        const rows = normalizeContestMatches(data)
        if (!active) return
        setMatches(rows)
        setSelectedMatchId((prev) => getDefaultSelectedMatchId(rows, prev))
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load matches')
      } finally {
        if (active) setHasLoadedMatchesOnce(true)
      }
    }

    loadMatches()
    return () => {
      active = false
    }
  }, [
    contestId,
    matchFilter,
    teamFilter,
    currentUserGameName,
    isLiveSyncReady,
    liveSyncRevision,
  ])

  useEffect(() => {
    if (!isLiveSyncReady || !selectedMatchId) return
    let active = true

    setParticipants([])
    setIsLoadingParticipants(true)
    setJoinedParticipantsCount(0)
    setPreviewXI([])
    setPreviewBackups([])

    const loadParticipants = async () => {
      try {
        const payload = normalizeContestParticipants(
          await fetchContestParticipants({
            contestId,
            matchId: selectedMatchId,
            userId: currentUserGameName,
            includeMissingTeams: canSeeMissingTeams,
          }),
        )
        if (!active) return
        setParticipants(payload.participants)
        setJoinedParticipantsCount(payload.joinedCount)
        setPreviewXI(payload.previewXI)
        setPreviewBackups(payload.previewBackups)
      } catch (error) {
        if (!active) return
        setParticipants([])
        setJoinedParticipantsCount(0)
        setPreviewXI([])
        setPreviewBackups([])
        setErrorText(error.message || 'Failed to load participants')
      } finally {
        if (active) {
          setIsLoadingParticipants(false)
        }
      }
    }

    loadParticipants()
    return () => {
      active = false
    }
  }, [
    canSeeMissingTeams,
    contestId,
    selectedMatchId,
    currentUserGameName,
    isLiveSyncReady,
    liveSyncRevision,
  ])

  const loadParticipantsForMatch = async (matchId) =>
    normalizeContestParticipants(
      await fetchContestParticipants({
        contestId,
        matchId,
        userId: currentUserGameName,
        includeMissingTeams: canSeeMissingTeams,
      }),
    )

  const sortedMatches = useMemo(() => sortContestMatches(matches), [matches])
  const activeSortedMatch =
    sortedMatches.find((match) => match.id === selectedMatchId) || sortedMatches[0]

  const teamOptions = useMemo(
    () => Array.from(new Set(sortedMatches.flatMap((match) => [match.home, match.away]))),
    [sortedMatches],
  )

  useEffect(() => {
    if (!isLiveSyncReady) return
    let active = true
    const candidates = sortedMatches.filter(
      (match) =>
        isLoggedIn &&
        ['notstarted', 'started'].includes(normalizeMatchStatus(match.status)) &&
        match.viewerJoined &&
        !match.hasTeam,
    )
    if (!candidates.length) {
      setCopyableMatchIds(new Set())
      return () => {
        active = false
      }
    }

    const loadCopyAvailability = async () => {
      const results = await Promise.allSettled(
        candidates.map(async (match) => {
          const payload = await fetchTeamCopySources({
            contestId,
            matchId: match.id,
            userId: currentUserGameName,
          })
          return {
            matchId: String(match.id),
            hasSources: Array.isArray(payload?.sources) && payload.sources.length > 0,
          }
        }),
      )
      if (!active) return
      setCopyableMatchIds(
        new Set(
          results
            .filter((result) => result.status === 'fulfilled' && result.value.hasSources)
            .map((result) => result.value.matchId),
        ),
      )
    }

    loadCopyAvailability()
    return () => {
      active = false
    }
  }, [contestId, currentUserGameName, isLoggedIn, sortedMatches, isLiveSyncReady])

  const onPreviewPlayer = async (player) => {
    try {
      if (!isLoggedIn) return
      setPreviewPlayer(player)
      setIsLoadingPreview(true)
      setPreviewXI([])
      setPreviewBackups([])
      const data = await fetchUserPicks({
        userId: player.userId,
        tournamentId,
        contestId,
        matchId: selectedMatchId,
      })
      setPreviewXI(data?.picksDetailed || data?.picks || [])
      setPreviewBackups(data?.backupsDetailed || data?.backups || [])
    } catch (error) {
      setErrorText(error.message || 'Failed to load user team')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const onComparePlayer = async (player) => {
    try {
      if (!isLoggedIn || !player?.userId) return
      setComparePlayer(player)
      setCompareData({ common: [], onlyMine: [], onlyTheirs: [] })
      setCompareError('')
      setIsLoadingCompare(true)
      const [mySelection, theirSelection] = await Promise.all([
        fetchUserPicks({
          userId: currentUserGameName,
          tournamentId,
          contestId,
          matchId: selectedMatchId,
        }),
        fetchUserPicks({
          userId: player.userId,
          tournamentId,
          contestId,
          matchId: selectedMatchId,
        }),
      ])
      setCompareData(
        buildTeamComparison(
          normalizeCompareTeam(mySelection),
          normalizeCompareTeam(theirSelection),
        ),
      )
    } catch (error) {
      setCompareError(error.message || 'Failed to compare teams')
    } finally {
      setIsLoadingCompare(false)
    }
  }

  const onPreviewMyTeamFromMatch = async (match) => {
    try {
      if (!isLoggedIn) return
      const targetMatchId = match?.id || selectedMatchId
      if (!targetMatchId) return
      setSelectedMatchId(targetMatchId)
      const participantsData = await loadParticipantsForMatch(targetMatchId)
      const currentParticipant = participantsData.participants.find(
        (entry) =>
          entry.userId === currentUserGameName ||
          entry.name?.toLowerCase() === currentUserGameName.toLowerCase(),
      )
      setPreviewPlayer({
        userId: currentUserGameName,
        name: currentUser?.name || currentUserGameName,
        points: Number(currentParticipant?.points || 0),
      })
      setIsLoadingPreview(true)
      setPreviewXI([])
      setPreviewBackups([])
      const data = await fetchUserPicks({
        userId: currentUserGameName,
        tournamentId,
        contestId,
        matchId: targetMatchId,
      })
      setPreviewXI(data?.picksDetailed || data?.picks || [])
      setPreviewBackups(data?.backupsDetailed || data?.backups || [])
    } catch (error) {
      setErrorText(error.message || 'Failed to load my team preview')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const onOpenCopyTeamModal = async (match) => {
    try {
      if (!isLoggedIn || !match?.id) return
      setCopyMatch(match)
      setSelectedMatchId(match.id)
      setCopySources([])
      setSelectedCopySourceId('')
      setCopyPlayerMap(new Map())
      setCopyError('')
      setIsLoadingCopySources(true)
      const [sourcesPayload, poolPayload] = await Promise.all([
        fetchTeamCopySources({
          contestId,
          matchId: match.id,
          userId: currentUserGameName,
        }),
        fetchTeamPool({
          contestId,
          tournamentId,
          matchId: match.id,
          userId: currentUserGameName,
        }),
      ])
      const sources = Array.isArray(sourcesPayload?.sources) ? sourcesPayload.sources : []
      const playerMap = new Map(
        getTeamPoolPlayers(poolPayload).map((player) => [String(player.id), player]),
      )
      setCopySources(sources)
      setSelectedCopySourceId(sources[0]?.id ? String(sources[0].id) : '')
      setCopyPlayerMap(playerMap)
    } catch (error) {
      setCopyError(error.message || 'Failed to load teams to copy')
    } finally {
      setIsLoadingCopySources(false)
    }
  }

  const onSaveCopiedTeam = async () => {
    const source = copySources.find(
      (entry) => String(entry.id) === String(selectedCopySourceId),
    )
    if (!source || !copyMatch?.id) return
    try {
      setIsSavingCopiedTeam(true)
      setCopyError('')
      await copyTeamSelection({
        sourceSelectionId: source.id,
        targetContestId: contestId,
        matchId: copyMatch.id,
        userId: currentUserGameName,
      })
      setMatches((rows) =>
        rows.map((match) =>
          String(match.id) === String(copyMatch.id)
            ? {
                ...match,
                hasTeam: true,
                viewerJoined: true,
                submittedCount: Number(match.submittedCount || 0) + 1,
              }
            : match,
        ),
      )
      const payload = await loadParticipantsForMatch(copyMatch.id)
      setParticipants(payload.participants)
      setJoinedParticipantsCount(payload.joinedCount)
      setPreviewXI(payload.previewXI)
      setPreviewBackups(payload.previewBackups)
      setCopyMatch(null)
      setCopySources([])
      setSelectedCopySourceId('')
    } catch (error) {
      setCopyError(error.message || 'Failed to copy team')
    } finally {
      setIsSavingCopiedTeam(false)
    }
  }

  useEffect(() => {
    if (!isLiveSyncReady || !showLeaderboardPreview) return
    let active = true
    const loadLeaderboardPreview = async () => {
      try {
        setIsLoadingLeaderboardPreview(true)
        setLeaderboardPreviewError('')
        const data = await fetchContestLeaderboard(contestId)
        if (!active) return
        setLeaderboardRows(data?.rows || [])
      } catch (error) {
        if (!active) return
        setLeaderboardPreviewError(error.message || 'Failed to load leaderboard preview')
      } finally {
        if (active) {
          setIsLoadingLeaderboardPreview(false)
        }
      }
    }
    loadLeaderboardPreview()
    return () => {
      active = false
    }
  }, [contestId, showLeaderboardPreview, isLiveSyncReady, liveSyncRevision])

  const leaderboardColumns = [
    { key: 'rank', label: 'Rank', render: (_, index) => index + 1 },
    { key: 'name', label: 'Game Name', render: (row) => getDisplayName(row) || '-' },
    { key: 'points', label: 'Points', render: (row) => Number(row.points || 0) },
  ]

  return (
    <section className="admin contest-detail">
      <ContestTopBar
        contestTitle={contestTitle}
        tournamentName={tournamentName}
        liveScoreSummary={activeSortedMatch?.liveScoreSummary || []}
        lastScoreUpdatedAt={lastScoreUpdatedAt}
        lastScoreUpdatedBy={lastScoreUpdatedBy}
        lastUpdatedContext={lastUpdatedContext}
        isLoading={isLoading}
        errorText={errorText}
        tournamentId={tournamentId}
        viewMode={viewMode}
        actions={
          canDeleteContest ? (
            <Button
              variant="danger"
              size="small"
              onClick={() => {
                setErrorText('')
                setShowDeleteContestModal(true)
              }}
            >
              Remove contest
            </Button>
          ) : null
        }
      />

      <div className="admin-grid contest-grid">
        <MatchesCard
          contestMode={contestMode}
          matches={sortedMatches}
          isLoadingMatches={isLoading}
          selectedMatchId={selectedMatchId}
          onSelectMatch={setSelectedMatchId}
          matchFilter={matchFilter}
          onChangeMatchFilter={setMatchFilter}
          teamFilter={teamFilter}
          onChangeTeamFilter={setTeamFilter}
          teamOptions={teamOptions}
          contestId={contestId}
          onPreviewLeaderboard={() => setShowLeaderboardPreview(true)}
          onPreviewTeam={onPreviewMyTeamFromMatch}
          onCopyTeam={onOpenCopyTeamModal}
          copyableMatchIds={copyableMatchIds}
          isLoggedIn={isLoggedIn}
        />

        <ParticipantsCard
          contestMode={contestMode}
          contestId={contestId}
          activeMatch={activeSortedMatch}
          participants={participants}
          isLoading={isLoadingParticipants}
          joinedCount={joinedParticipantsCount}
          onPreviewPlayer={onPreviewPlayer}
          onComparePlayer={onComparePlayer}
          canEditFullTeams={canEditFullTeams}
          canSeeMissingTeams={canSeeMissingTeams}
          isLoggedIn={isLoggedIn}
          viewerUserId={currentUserGameName}
          viewerJoined={Boolean(activeSortedMatch?.viewerJoined)}
        />
      </div>

      <TeamPreviewDrawer
        contestMode={contestMode}
        previewPlayer={previewPlayer}
        activeMatch={activeSortedMatch}
        previewXI={previewXI}
        previewBackups={previewBackups}
        showTeam
        isLoading={isLoadingPreview}
        onClose={() => {
          setPreviewPlayer(null)
          setPreviewXI([])
          setPreviewBackups([])
          setIsLoadingPreview(false)
        }}
      />

      <CopyTeamModal
        open={Boolean(copyMatch)}
        onClose={() => {
          setCopyMatch(null)
          setCopySources([])
          setSelectedCopySourceId('')
          setCopyError('')
        }}
        sources={copySources}
        selectedSourceId={selectedCopySourceId}
        playerMap={copyPlayerMap}
        isLoading={isLoadingCopySources}
        isSaving={isSavingCopiedTeam}
        errorText={copyError}
        onSelectSource={setSelectedCopySourceId}
        onSave={onSaveCopiedTeam}
      />

      <TeamCompareModal
        comparePlayer={comparePlayer}
        compareData={compareData}
        isLoading={isLoadingCompare}
        errorText={compareError}
        myName={currentUser?.gameName || currentUserGameName}
        onClose={() => {
          setComparePlayer(null)
          setCompareData({ common: [], onlyMine: [], onlyTheirs: [] })
          setCompareError('')
          setIsLoadingCompare(false)
        }}
      />

      <ResourceRemovalModal
        key={`contest-remove-${contestId}-${showDeleteContestModal ? 'open' : 'closed'}`}
        open={showDeleteContestModal}
        onClose={() => setShowDeleteContestModal(false)}
        resourceId={contestId}
        resourceName={contestTitle}
        resourceLabel="contest"
        impactLabel="contest impact"
        impactRows={[
          { key: 'matchCount', label: 'Matches' },
          { key: 'joinedCount', label: 'Participants' },
          { key: 'teamSelectionsCount', label: 'Team selections' },
          { key: 'fixedRostersCount', label: 'Fixed rosters' },
          { key: 'contestScoresCount', label: 'Contest scores' },
        ]}
        loadPreview={fetchContestRemovalPreview}
        isSubmitting={isRemovingContest}
        onConfirm={async () => {
          try {
            setIsRemovingContest(true)
            setErrorText('')
            await removeAdminContest(
              contestId,
              currentUser?.gameName || currentUser?.email || '',
            )
            setShowDeleteContestModal(false)
            navigate('/fantasy')
          } catch (error) {
            setErrorText(error.message || 'Failed to remove contest')
          } finally {
            setIsRemovingContest(false)
          }
        }}
      />

      <Modal
        open={showLeaderboardPreview}
        onClose={() => setShowLeaderboardPreview(false)}
        title="Quick leaderboard preview"
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              size="small"
              onClick={() => setShowLeaderboardPreview(false)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="small"
              to={`/tournaments/${tournamentId}/contests/${contestId}/leaderboard${viewMode ? `?view=${encodeURIComponent(viewMode)}` : ''}`}
            >
              Open leaderboard page
            </Button>
          </>
        }
      >
        {isLoadingLeaderboardPreview && (
          <p className="team-note">Loading leaderboard...</p>
        )}
        {!!leaderboardPreviewError && (
          <p className="error-text">{leaderboardPreviewError}</p>
        )}
        {!isLoadingLeaderboardPreview && !leaderboardPreviewError && (
          <StickyTable
            columns={leaderboardColumns}
            rows={leaderboardRows.slice(0, 15)}
            rowKey={(row, index) => row.id || `${getDisplayName(row) || 'row'}-${index}`}
            emptyText="No leaderboard rows"
            wrapperClassName="leaderboard-preview-table-wrap"
            tableClassName="leaderboard-table"
          />
        )}
      </Modal>
    </section>
  )
}

export default ContestDetail
