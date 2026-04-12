import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ApiFailureTile from '../components/ui/ApiFailureTile.jsx'
import ContestTileCard from '../components/contest/ContestTileCard.jsx'
import LastScoreMeta from '../components/ui/LastScoreMeta.jsx'
import LoadingNote from '../components/ui/LoadingNote.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import { fetchContests, fetchTournaments } from '../lib/api.js'
import { getStoredUser } from '../lib/auth.js'

const tournamentPalette = [
  '#0f7a67',
  '#2f66e9',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#0e7490',
]

function AuctionHub() {
  const [selectedTournament, setSelectedTournament] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [tournaments, setTournaments] = useState([])
  const [contests, setContests] = useState([])

  const currentUser = getStoredUser()
  const currentUserId =
    currentUser?.userId || currentUser?.gameName || currentUser?.email || ''

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const [tournamentsRes, contestsRes] = await Promise.all([
          fetchTournaments(),
          fetchContests({ game: 'Fantasy', userId: currentUserId }),
        ])
        if (!active) return

        const auctionContests = (contestsRes || []).filter(
          (contest) => contest.mode === 'fixed_roster',
        )
        const tournamentIds = new Set(
          auctionContests.map((contest) => contest.tournamentId),
        )
        const auctionTournaments = (tournamentsRes || []).filter((item) =>
          tournamentIds.has(item.id),
        )

        setTournaments(auctionTournaments)
        setContests(auctionContests)
        setSelectedTournament((prev) =>
          auctionTournaments.some((item) => item.id === prev)
            ? prev
            : auctionTournaments[0]?.id || '',
        )
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load auction contests')
      } finally {
        if (active) setIsLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [currentUserId])

  const reloadAuctionData = async () => {
    const [tournamentsRes, contestsRes] = await Promise.all([
      fetchTournaments(),
      fetchContests({ game: 'Fantasy', userId: currentUserId }),
    ])
    const auctionContests = (contestsRes || []).filter(
      (contest) => contest.mode === 'fixed_roster',
    )
    const tournamentIds = new Set(auctionContests.map((contest) => contest.tournamentId))
    const auctionTournaments = (tournamentsRes || []).filter((item) =>
      tournamentIds.has(item.id),
    )
    setTournaments(auctionTournaments)
    setContests(auctionContests)
    setSelectedTournament((prev) =>
      auctionTournaments.some((item) => item.id === prev)
        ? prev
        : auctionTournaments[0]?.id || '',
    )
  }

  const tournamentNameMap = useMemo(() => {
    return tournaments.reduce((acc, item) => {
      acc[item.id] = item.name
      return acc
    }, {})
  }, [tournaments])

  const tournamentColorMap = useMemo(() => {
    return tournaments.reduce((acc, item, index) => {
      acc[item.id] = tournamentPalette[index % tournamentPalette.length]
      return acc
    }, {})
  }, [tournaments])

  const tournamentContests = useMemo(() => {
    return contests.filter((contest) => {
      const tournamentOk =
        selectedTournament && contest.tournamentId === selectedTournament
      const statusOk = selectedStatus === 'all' || contest.status === selectedStatus
      return tournamentOk && statusOk
    })
  }, [contests, selectedTournament, selectedStatus])

  const selectedTournamentName =
    tournamentNameMap[selectedTournament] || selectedTournament || 'Tournament'
  const selectedTournamentLastScore = useMemo(() => {
    const rows = contests.filter(
      (contest) =>
        contest.tournamentId === selectedTournament &&
        contest.mode === 'fixed_roster',
    )
    return rows.reduce(
      (latest, contest) => {
        const raw = (contest?.lastUpdatedAt || contest?.lastScoreUpdatedAt || '')
          .toString()
          .trim()
        if (!raw) return latest
        const parsed = new Date(raw)
        const time = parsed.getTime()
        if (Number.isNaN(time) || time <= latest.time) return latest
        return {
          time,
          at: raw,
          by: contest?.lastUpdatedBy || contest?.lastScoreUpdatedBy || '',
          context: contest?.lastUpdatedContext || '',
        }
      },
      { time: Number.NEGATIVE_INFINITY, at: '', by: '', context: '' },
    )
  }, [contests, selectedTournament])
  const showApiFailureTile =
    !isLoading && !!errorText && tournaments.length === 0 && contests.length === 0

  const badgeText = (name = '') => {
    const words = name.split(' ').filter(Boolean)
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
  }

  const contestsByTournament = useMemo(() => {
    return contests.reduce((acc, contest) => {
      if (!acc[contest.tournamentId]) acc[contest.tournamentId] = []
      acc[contest.tournamentId].push(contest)
      return acc
    }, {})
  }, [contests])

  return (
    <section className="admin auction-hub auction-hub-page">
      <div className="section-head-compact auction-hub-header">
        <div className="contest-section-head">
          <h2>Auction Contests</h2>
        </div>
        <p className="team-note auction-hub-note">
          Browse imported contests and follow squads, matches, and leaderboard in one
          place.
        </p>
        <LoadingNote
          loading={isLoading}
          errorText={showApiFailureTile ? '' : errorText}
        />
      </div>

      {showApiFailureTile ? (
        <ApiFailureTile
          title="Auction feed unavailable"
          message={errorText}
          onRetry={async () => {
            try {
              setIsLoading(true)
              setErrorText('')
              await reloadAuctionData()
            } catch (error) {
              setErrorText(error.message || 'Failed to load auction contests')
            } finally {
              setIsLoading(false)
            }
          }}
        />
      ) : null}

      {!showApiFailureTile && (
        <div className="fantasy-hub-layout auction-hub-layout">
          <div className="fantasy-tournament-section">
            <h3>Available Tournaments</h3>
            {tournaments.length === 0 && !isLoading ? (
              <div className="dashboard-empty-state">
                <h3>No tournaments available</h3>
                <p>No published auction tournaments are available right now.</p>
              </div>
            ) : (
              <div className="tournament-tile-grid">
                {tournaments.map((item, index) => (
                  <article
                    key={item.id}
                    className={`team-card tournament-card tournament-filter-tile ${selectedTournament === item.id ? 'active' : ''}`.trim()}
                    style={{
                      '--tournament-color':
                        tournamentPalette[index % tournamentPalette.length],
                      '--tile-index': index,
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTournament(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedTournament(item.id)
                      }
                    }}
                  >
                    <div className="tournament-card-head">
                      <div className="tournament-badge">{badgeText(item.name)}</div>
                      <div>
                        <h3>{item.name}</h3>
                        <p className="team-note">
                          {(contestsByTournament[item.id] || []).length} auction contests
                        </p>
                      </div>
                    </div>
                    <div className="top-actions">
                      <Link
                        to={`/tournaments/${item.id}/cricketer-stats?view=auction`}
                        className="leaderboard-link"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Stats
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="fantasy-hub-main auction-hub-main">
            <div className="flow-breadcrumb">
              <span>Auction</span>
              <span>/</span>
              <strong>{selectedTournamentName}</strong>
            </div>
            <LastScoreMeta
              lastScoreUpdatedAt={selectedTournamentLastScore.at}
              lastScoreUpdatedBy={selectedTournamentLastScore.by}
              lastUpdatedContext={selectedTournamentLastScore.context}
              compact
            />
            {tournaments.length === 0 && !isLoading ? (
              <div className="dashboard-empty-state">
                <h3>No tournaments available</h3>
                <p>
                  Ask an admin to publish an auction tournament, then it will appear here.
                </p>
              </div>
            ) : (
              <div className="fantasy-contest-sections">
                <div>
                  <div className="contest-section-head auction-section-head">
                    <h3>{`Visible contests (${tournamentContests.length})`}</h3>
                    <div className="module-filters compact fantasy-status-filter auction-status-filter">
                      <SelectField
                        value={selectedStatus}
                        onChange={(event) => setSelectedStatus(event.target.value)}
                        options={[
                          { value: 'all', label: 'All status' },
                          { value: 'Open', label: 'Open' },
                          { value: 'Starting Soon', label: 'Starting Soon' },
                          { value: 'Locked', label: 'Locked' },
                          { value: 'Completed', label: 'Completed' },
                        ]}
                      />
                    </div>
                  </div>
                  <div className="compact-card-grid contest-discovery-grid">
                    {tournamentContests.map((contest) => {
                      const participantCount = Number(
                        contest.joinedCount ?? contest.participants ?? contest.teams ?? 0,
                      )
                      const rosterSize = Number(contest.teamSize ?? 15)
                      const points =
                        contest?.points == null || contest?.points === ''
                          ? '-'
                          : contest.points
                      const rank =
                        contest?.rank == null || contest?.rank === ''
                          ? '-'
                          : contest.rank
                      return (
                        <ContestTileCard
                          key={contest.id}
                          contest={contest}
                          className="fantasy auction-contest-card"
                          tournamentName={tournamentNameMap[contest.tournamentId]}
                          tournamentColor={tournamentColorMap[contest.tournamentId]}
                          participantsText={`Participants ${participantCount}`}
                          statsLeftText={`Points ${points}`}
                          statsRightText={`Rank #${rank}`}
                          extraNotes={[
                            `Fixed ${rosterSize}-player tournament rosters`,
                            'Leaderboard counts the top 11 roster players by overall points',
                          ]}
                          openTo={`/tournaments/${contest.tournamentId}/contests/${contest.id}?view=auction`}
                          leaderboardTo={`/tournaments/${contest.tournamentId}/contests/${contest.id}/leaderboard?view=auction`}
                        />
                      )
                    })}
                  </div>
                  {!isLoading &&
                    selectedTournament &&
                    tournamentContests.length === 0 && (
                      <div className="dashboard-empty-state">
                        <h3>No auction contests yet</h3>
                        <p>
                          This tournament is loaded, but there are no imported external
                          contests for the selected filters.
                        </p>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default AuctionHub
