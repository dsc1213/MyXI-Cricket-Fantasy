import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ContestTopBar from '../components/contest-detail/ContestTopBar.jsx'
import MatchesCard from '../components/contest-detail/MatchesCard.jsx'
import ParticipantsCard from '../components/contest-detail/ParticipantsCard.jsx'
import TeamPreviewDrawer from '../components/contest-detail/TeamPreviewDrawer.jsx'
import Button from '../components/ui/Button.jsx'
import Modal from '../components/ui/Modal.jsx'
import StickyTable from '../components/ui/StickyTable.jsx'
import {
  deleteAdminContest,
  fetchContest,
  fetchContestLeaderboard,
  fetchContestMatches,
  fetchContestParticipants,
  fetchTournaments,
  fetchUserPicks,
} from '../lib/api.js'
import { getStoredUser } from '../lib/auth.js'

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
  const canDeleteContest = ['admin', 'master_admin'].includes(currentUser?.role)
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [contestTitle, setContestTitle] = useState(contestId)
  const [contestMode, setContestMode] = useState('')
  const [tournamentName, setTournamentName] = useState(tournamentId)
  const [lastScoreUpdatedAt, setLastScoreUpdatedAt] = useState('')
  const [matches, setMatches] = useState([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [matchFilter, setMatchFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [participants, setParticipants] = useState([])
  const [joinedParticipantsCount, setJoinedParticipantsCount] = useState(0)
  const [previewXI, setPreviewXI] = useState([])
  const [previewBackups, setPreviewBackups] = useState([])
  const [previewPlayer, setPreviewPlayer] = useState(null)
  const [showLeaderboardPreview, setShowLeaderboardPreview] = useState(false)
  const [leaderboardRows, setLeaderboardRows] = useState([])
  const [isLoadingLeaderboardPreview, setIsLoadingLeaderboardPreview] = useState(false)
  const [leaderboardPreviewError, setLeaderboardPreviewError] = useState('')
  const [showDeleteContestModal, setShowDeleteContestModal] = useState(false)
  const [isDeletingContest, setIsDeletingContest] = useState(false)

  useEffect(() => {
    let active = true

    const loadMeta = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const [contest, tournaments] = await Promise.all([
          fetchContest(contestId),
          fetchTournaments(),
        ])
        if (!active) return
        setContestTitle(contest.name)
        setContestMode(contest.mode || '')
        setLastScoreUpdatedAt(contest.lastScoreUpdatedAt || '')
        const tournament = tournaments.find((item) => item.id === tournamentId)
        setTournamentName(tournament?.name || tournamentId)
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load contest')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    loadMeta()
    return () => {
      active = false
    }
  }, [contestId, tournamentId])

  useEffect(() => {
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
        if (!active) return
        setMatches(data)
        setSelectedMatchId((prev) => {
          if (!prev && data.length > 0) return data[0].id
          if (prev && !data.find((item) => item.id === prev)) return data[0]?.id || ''
          return prev
        })
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load matches')
      }
    }

    loadMatches()
    return () => {
      active = false
    }
  }, [contestId, matchFilter, teamFilter, currentUserGameName])

  useEffect(() => {
    if (!selectedMatchId) return
    let active = true

    const loadParticipants = async () => {
      try {
        const data = await fetchContestParticipants({
          contestId,
          matchId: selectedMatchId,
          userId: currentUserGameName,
        })
        if (!active) return
        setParticipants(data.participants || [])
        setJoinedParticipantsCount(Number(data.joinedCount || 0))
        setPreviewXI(data.previewXI || [])
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load participants')
      }
    }

    loadParticipants()
    return () => {
      active = false
    }
  }, [contestId, selectedMatchId, currentUserGameName])

  const onPreviewPlayer = async (player) => {
    try {
      if (!isLoggedIn) return
      setPreviewPlayer(player)
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
    }
  }

  const onPreviewMyTeamFromMatch = async (match) => {
    try {
      if (!isLoggedIn) return
      const targetMatchId = match?.id || selectedMatchId
      if (!targetMatchId) return
      setSelectedMatchId(targetMatchId)
      const participantsData = await fetchContestParticipants({
        contestId,
        matchId: targetMatchId,
        userId: currentUserGameName,
      })
      const currentParticipant = (participantsData?.participants || []).find(
        (entry) =>
          entry.userId === currentUserGameName ||
          entry.name?.toLowerCase() === currentUserGameName.toLowerCase(),
      )
      setPreviewPlayer({
        userId: currentUserGameName,
        name: currentUser?.name || currentUserGameName,
        points: Number(currentParticipant?.points || 0),
      })
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
    }
  }

  const activeMatch = matches.find((match) => match.id === selectedMatchId) || matches[0]

  const teamOptions = useMemo(
    () => Array.from(new Set(matches.flatMap((match) => [match.home, match.away]))),
    [matches],
  )

  useEffect(() => {
    if (!showLeaderboardPreview) return
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
  }, [contestId, showLeaderboardPreview])

  const leaderboardColumns = [
    { key: 'rank', label: 'Rank', render: (_, index) => index + 1 },
    { key: 'name', label: 'Game Name', render: (row) => row.name },
    { key: 'points', label: 'Points', render: (row) => Number(row.points || 0) },
  ]

  return (
    <section className="admin contest-detail">
      <ContestTopBar
        contestTitle={contestTitle}
        tournamentName={tournamentName}
        lastScoreUpdatedAt={lastScoreUpdatedAt}
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
              Delete contest
            </Button>
          ) : null
        }
      />

      <div className="admin-grid contest-grid">
        <MatchesCard
          contestMode={contestMode}
          matches={matches}
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
          isLoggedIn={isLoggedIn}
        />

        <ParticipantsCard
          contestMode={contestMode}
          contestId={contestId}
          activeMatch={activeMatch}
          participants={participants}
          joinedCount={joinedParticipantsCount}
          onPreviewPlayer={onPreviewPlayer}
          canEditFullTeams={canEditFullTeams}
          isLoggedIn={isLoggedIn}
        />
      </div>

      <TeamPreviewDrawer
        contestMode={contestMode}
        previewPlayer={previewPlayer}
        activeMatch={activeMatch}
        previewXI={previewXI}
        previewBackups={previewBackups}
        onClose={() => setPreviewPlayer(null)}
      />

      <Modal
        open={showDeleteContestModal}
        onClose={() => setShowDeleteContestModal(false)}
        title="Delete contest"
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              size="small"
              onClick={() => setShowDeleteContestModal(false)}
            >
              No
            </Button>
            <Button
              variant="danger"
              size="small"
              disabled={isDeletingContest}
              onClick={async () => {
                try {
                  setIsDeletingContest(true)
                  setErrorText('')
                  await deleteAdminContest(
                    contestId,
                    currentUser?.gameName || currentUser?.email || '',
                  )
                  setShowDeleteContestModal(false)
                  navigate('/fantasy')
                } catch (error) {
                  setErrorText(error.message || 'Failed to delete contest')
                } finally {
                  setIsDeletingContest(false)
                }
              }}
            >
              {isDeletingContest ? 'Deleting...' : 'Yes, delete'}
            </Button>
          </>
        }
      >
        <p className="error-text">
          This removes the contest and all join mappings for this contest. Continue?
        </p>
      </Modal>

      <Modal
        open={showLeaderboardPreview}
        onClose={() => setShowLeaderboardPreview(false)}
        title="Quick leaderboard preview"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="small" onClick={() => setShowLeaderboardPreview(false)}>
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
        {isLoadingLeaderboardPreview && <p className="team-note">Loading leaderboard...</p>}
        {!!leaderboardPreviewError && <p className="error-text">{leaderboardPreviewError}</p>}
        {!isLoadingLeaderboardPreview && !leaderboardPreviewError && (
          <StickyTable
            columns={leaderboardColumns}
            rows={leaderboardRows.slice(0, 15)}
            rowKey={(row, index) => row.id || `${row.name}-${index}`}
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
