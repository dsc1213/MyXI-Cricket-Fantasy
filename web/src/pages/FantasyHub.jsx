import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ApiFailureTile from '../components/ui/ApiFailureTile.jsx'
import Button from '../components/ui/Button.jsx'
import LoadingNote from '../components/ui/LoadingNote.jsx'
import LastScoreMeta from '../components/ui/LastScoreMeta.jsx'
import Modal from '../components/ui/Modal.jsx'
import PlayingXiModalLink from '../components/ui/PlayingXiModalLink.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import ContestTileCard from '../components/contest/ContestTileCard.jsx'
import {
  createAdminContest,
  fetchContestMatchOptions,
  fetchContests,
  fetchTournamentCatalog,
  fetchTournaments,
  joinContest,
} from '../lib/api.js'
import { getStoredUser } from '../lib/auth.js'
import { formatCompactMatchLabel } from '../lib/matchLabels.js'

const tournamentPalette = [
  '#0f7a67',
  '#2f66e9',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#0e7490',
]

const normalizeTournamentRow = (row = {}) => ({
  ...row,
  id: row?.id != null ? String(row.id) : '',
})

const normalizeContestRow = (row = {}) => ({
  ...row,
  id: row?.id != null ? String(row.id) : '',
  tournamentId: row?.tournamentId != null ? String(row.tournamentId) : '',
  teams:
    row?.teams != null
      ? Number(row.teams || 0)
      : Number(row?.maxParticipants || row?.maxPlayers || 0),
  maxPlayers:
    row?.maxPlayers != null
      ? Number(row.maxPlayers || 0)
      : Number(row?.maxParticipants || row?.teams || 0),
  hasTeam: Boolean(row?.hasTeam),
})

const isContestJoined = (contest = {}) => Boolean(contest?.joined || contest?.hasTeam)

const formatContestCountdown = (startAt, nowTs) => {
  if (!startAt) return ''
  const parsed = new Date(startAt)
  if (Number.isNaN(parsed.getTime())) return ''
  const diff = parsed.getTime() - nowTs
  if (diff <= 0) return ''
  const totalMinutes = Math.floor(diff / (60 * 1000))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  const segments = []
  if (days > 0) segments.push(`${days}d`)
  if (days > 0 || hours > 0) segments.push(`${hours}h`)
  segments.push(`${minutes}m`)
  return `${segments.join(':')} remaining`
}

const shouldShowContestStart = (startAt, nowTs) => {
  if (!startAt) return true
  const parsed = new Date(startAt)
  if (Number.isNaN(parsed.getTime())) return true
  return parsed.getTime() > nowTs
}

const formatLocalMatchOptionDate = (value) => {
  const raw = (value || '').toString().trim()
  if (!raw) return 'Manual'
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  })
}

function FantasyHub() {
  const [selectedTournament, setSelectedTournament] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [tournaments, setTournaments] = useState([])
  const [contests, setContests] = useState([])
  const [showCreateContestModal, setShowCreateContestModal] = useState(false)
  const [isSavingContest, setIsSavingContest] = useState(false)
  const [contestMatchOptions, setContestMatchOptions] = useState([])
  const [selectedContestMatchIds, setSelectedContestMatchIds] = useState([])
  const [isLoadingContestMatchOptions, setIsLoadingContestMatchOptions] = useState(false)
  const [countdownNow, setCountdownNow] = useState(() => Date.now())
  const [createContestForm, setCreateContestForm] = useState({
    name: '',
    tournamentId: '',
    game: 'Fantasy',
    teams: 0,
    startAt: '',
  })

  const currentUser = getStoredUser()
  const currentUserId =
    currentUser?.userId || currentUser?.gameName || currentUser?.email || ''
  const isAdminUser = ['admin', 'master_admin'].includes(currentUser?.role)

  const normalizeAdminTournamentRows = (rows = []) =>
    (rows || [])
      .filter((row) => row?.enabled)
      .map((row) => ({
        id: row?.id != null ? String(row.id) : '',
        name: row.name,
      }))

  const applyFantasyResponses = (tournamentsRes, contestsRes) => {
    const nextTournaments = Array.isArray(tournamentsRes)
      ? tournamentsRes.map(normalizeTournamentRow)
      : []
    const nextContests = Array.isArray(contestsRes)
      ? contestsRes.map(normalizeContestRow)
      : []
    setTournaments(nextTournaments)
    setContests(nextContests)
    setSelectedTournament((prev) =>
      nextTournaments.some((item) => item.id === prev)
        ? prev
        : nextTournaments[0]?.id || '',
    )
  }

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const [tournamentsResult, contestsResult] = await Promise.allSettled([
          isAdminUser ? fetchTournamentCatalog() : fetchTournaments(),
          fetchContests({ game: 'Fantasy', userId: currentUserId }),
        ])
        if (!active) return
        const tournamentsRes =
          tournamentsResult.status === 'fulfilled' ? tournamentsResult.value : []
        const contestsRes =
          contestsResult.status === 'fulfilled' ? contestsResult.value : []
        const effectiveTournaments = isAdminUser
          ? normalizeAdminTournamentRows(tournamentsRes)
          : tournamentsRes
        applyFantasyResponses(effectiveTournaments, contestsRes)
        if (
          tournamentsResult.status === 'rejected' ||
          contestsResult.status === 'rejected'
        ) {
          const message =
            tournamentsResult.status === 'rejected'
              ? tournamentsResult.reason?.message
              : contestsResult.reason?.message
          setErrorText(message || 'Failed to load fantasy contests')
        }
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load fantasy contests')
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
  }, [currentUserId, isAdminUser])

  const reloadFantasyData = async () => {
    const [tournamentsResult, contestsResult] = await Promise.allSettled([
      isAdminUser ? fetchTournamentCatalog() : fetchTournaments(),
      fetchContests({ game: 'Fantasy', userId: currentUserId }),
    ])
    const tournamentsRes =
      tournamentsResult.status === 'fulfilled' ? tournamentsResult.value : []
    const contestsRes = contestsResult.status === 'fulfilled' ? contestsResult.value : []
    const effectiveTournaments = isAdminUser
      ? normalizeAdminTournamentRows(tournamentsRes)
      : tournamentsRes
    applyFantasyResponses(effectiveTournaments, contestsRes)
    if (tournamentsResult.status === 'rejected' || contestsResult.status === 'rejected') {
      const message =
        tournamentsResult.status === 'rejected'
          ? tournamentsResult.reason?.message
          : contestsResult.reason?.message
      throw new Error(message || 'Failed to load fantasy contests')
    }
    return {
      tournaments: Array.isArray(effectiveTournaments)
        ? effectiveTournaments.map(normalizeTournamentRow)
        : [],
      contests: Array.isArray(contestsRes) ? contestsRes.map(normalizeContestRow) : [],
    }
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
      if (contest.mode === 'fixed_roster') return false
      const tournamentOk =
        selectedTournament && contest.tournamentId === selectedTournament
      const statusOk = selectedStatus === 'all' || contest.status === selectedStatus
      return tournamentOk && statusOk
    })
  }, [contests, selectedTournament, selectedStatus])

  const availableContests = useMemo(
    () => tournamentContests.filter((contest) => !isContestJoined(contest)),
    [tournamentContests],
  )
  const joinedContests = useMemo(
    () => tournamentContests.filter((contest) => isContestJoined(contest)),
    [tournamentContests],
  )

  const selectedTournamentName =
    tournamentNameMap[selectedTournament] || selectedTournament || 'Tournament'
  const selectedTournamentLastScore = useMemo(() => {
    const rows = contests.filter(
      (contest) =>
        contest.tournamentId === selectedTournament && contest.mode !== 'fixed_roster',
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
  const canCreateContest = !isLoading && tournaments.length > 0
  const canCreateWithMatches = selectedContestMatchIds.length > 0

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdownNow(Date.now())
    }, 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  const badgeText = (name = '') => {
    const words = name.split(' ').filter(Boolean)
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
  }

  const contestsByTournament = useMemo(() => {
    return contests.reduce((acc, contest) => {
      if (contest.mode === 'fixed_roster') return acc
      if (!acc[contest.tournamentId]) acc[contest.tournamentId] = []
      acc[contest.tournamentId].push(contest)
      return acc
    }, {})
  }, [contests])

  useEffect(() => {
    if (!showCreateContestModal || !createContestForm.tournamentId) {
      setContestMatchOptions([])
      setSelectedContestMatchIds([])
      return
    }
    let active = true
    const loadContestMatchOptions = async () => {
      try {
        setIsLoadingContestMatchOptions(true)
        const rows = await fetchContestMatchOptions(createContestForm.tournamentId)
        if (!active) return
        const allMatchIds = (rows || []).map((item) => item.id)
        setContestMatchOptions(rows || [])
        setSelectedContestMatchIds((prev) => {
          const next = prev.filter((id) => allMatchIds.includes(id))
          if (next.length) return next
          return allMatchIds
        })
      } catch (error) {
        if (!active) return
        setContestMatchOptions([])
        setSelectedContestMatchIds([])
        setErrorText(error.message || 'Failed to load contest match options')
      } finally {
        if (active) setIsLoadingContestMatchOptions(false)
      }
    }
    loadContestMatchOptions()
    return () => {
      active = false
    }
  }, [showCreateContestModal, createContestForm.tournamentId])

  return (
    <section className="admin fantasy-hub-page">
      <div className="section-head-compact fantasy-hub-header">
        <div className="contest-section-head">
          <h2>Fantasy Contests</h2>
          {isAdminUser && (
            <div className="top-actions">
              <Button
                variant="primary"
                size="small"
                disabled={!canCreateContest}
                title={
                  canCreateContest
                    ? 'Create a contest'
                    : 'Create contest is enabled only when tournaments are available'
                }
                onClick={() => {
                  setNotice('')
                  setErrorText('')
                  setCreateContestForm((prev) => ({
                    ...prev,
                    tournamentId: selectedTournament || tournaments[0]?.id || '',
                  }))
                  setShowCreateContestModal(true)
                }}
              >
                + Create contest
              </Button>
            </div>
          )}
        </div>
        <LoadingNote
          loading={isLoading}
          errorText={showApiFailureTile ? '' : errorText}
        />
        {!!notice && <p className="success-text">{notice}</p>}
      </div>

      {showApiFailureTile ? (
        <ApiFailureTile
          title="Fantasy feed unavailable"
          message={errorText}
          onRetry={async () => {
            try {
              setIsLoading(true)
              setErrorText('')
              await reloadFantasyData()
            } catch (error) {
              setErrorText(error.message || 'Failed to load fantasy contests')
            } finally {
              setIsLoading(false)
            }
          }}
        />
      ) : (
        <div className="fantasy-hub-layout">
          <div className="fantasy-tournament-section">
            <h3>Available Tournaments</h3>
            {tournaments.length === 0 && !isLoading ? (
              <div className="dashboard-empty-state">
                <h3>No tournaments available</h3>
                <p>No published fantasy tournaments are available right now.</p>
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
                          {(contestsByTournament[item.id] || []).length} contests
                          available
                        </p>
                      </div>
                    </div>
                    <div className="top-actions">
                      <Link
                        to={`/tournaments/${item.id}`}
                        className="ghost small"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Open
                      </Link>
                      <Link
                        to={`/tournaments/${item.id}/cricketer-stats`}
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

          <div className="fantasy-hub-main">
            <div className="flow-breadcrumb">
              <span>Fantasy</span>
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
                  Ask an admin to add a tournament to Fantasy, then it will appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="module-filters compact fantasy-status-filter">
                  <SelectField
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value)}
                    options={[
                      { value: 'all', label: 'All status' },
                      { value: 'Open', label: 'Open' },
                      { value: 'Starting Soon', label: 'Starting Soon' },
                      { value: 'In Progress', label: 'In Progress' },
                      { value: 'Locked', label: 'Locked' },
                      { value: 'Completed', label: 'Completed' },
                    ]}
                  />
                </div>

                <div className="fantasy-contest-sections">
                  <div>
                    <div className="contest-section-head">
                      <h3>{`Available (${availableContests.length})`}</h3>
                    </div>
                    <div className="compact-card-grid contest-discovery-grid">
                      {availableContests.map((contest) => {
                        const joinedCount = Number(
                          contest.joinedCount ?? contest.participants ?? 0,
                        )
                        const maxPlayers = Number(
                          contest.maxPlayers ?? contest.teams ?? 0,
                        )
                        const countdownLabel = formatContestCountdown(
                          contest.startAt,
                          countdownNow,
                        )
                        const showContestStart = shouldShowContestStart(
                          contest.startAt,
                          countdownNow,
                        )
                        return (
                          <ContestTileCard
                            contest={contest}
                            className="fantasy"
                            tournamentName={tournamentNameMap[contest.tournamentId]}
                            tournamentColor={
                              tournamentColorMap[contest.tournamentId] || '#2f66e9'
                            }
                            participantsText={`Participants ${joinedCount}${maxPlayers > 0 ? ` / ${maxPlayers}` : ''}`}
                            startText={
                              showContestStart
                                ? `Starts: ${contest.startAt ? new Date(contest.startAt).toLocaleString() : 'Manual start'}`
                                : ''
                            }
                            countdownText={countdownLabel}
                            primaryAction={
                              <Button
                                variant="primary"
                                size="small"
                                disabled={
                                  !currentUserId ||
                                  contest.hasCapacity === false ||
                                  contest.joinOpen === false
                                }
                                onClick={async () => {
                                  try {
                                    await joinContest({
                                      contestId: contest.id,
                                      userId: currentUserId,
                                    })
                                    await reloadFantasyData()
                                  } catch (error) {
                                    setErrorText(
                                      error.message || 'Failed to join contest',
                                    )
                                  }
                                }}
                              >
                                {contest.hasCapacity === false
                                  ? 'Contest full'
                                  : contest.joinOpen === false
                                    ? 'Started'
                                    : 'Join'}
                              </Button>
                            }
                            openTo={`/tournaments/${contest.tournamentId}/contests/${contest.id}`}
                            leaderboardTo={`/tournaments/${contest.tournamentId}/contests/${contest.id}/leaderboard`}
                          />
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="contest-section-head">
                      <h3>{`Joined (${joinedContests.length})`}</h3>
                    </div>
                    <div className="compact-card-grid contest-discovery-grid">
                      {joinedContests.map((contest) => {
                        const joinedCount = Number(
                          contest.joinedCount ?? contest.participants ?? 0,
                        )
                        const maxPlayers = Number(
                          contest.maxPlayers ?? contest.teams ?? 0,
                        )
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
                            contest={contest}
                            className="fantasy"
                            tournamentName={tournamentNameMap[contest.tournamentId]}
                            tournamentColor={
                              tournamentColorMap[contest.tournamentId] || '#2f66e9'
                            }
                            participantsText={`Participants ${joinedCount}${maxPlayers > 0 ? ` / ${maxPlayers}` : ''}`}
                            statsLeftText={`Points ${points}`}
                            statsRightText={`Rank #${rank}`}
                            openTo={`/tournaments/${contest.tournamentId}/contests/${contest.id}`}
                            leaderboardTo={`/tournaments/${contest.tournamentId}/contests/${contest.id}/leaderboard`}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Modal
        open={showCreateContestModal}
        onClose={() => setShowCreateContestModal(false)}
        title="Create contest"
        size="md"
        closeOnBackdrop={false}
        footer={
          <>
            <Button
              variant="ghost"
              size="small"
              onClick={() => setShowCreateContestModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              disabled={
                isSavingContest ||
                isLoadingContestMatchOptions ||
                !createContestForm.name ||
                !createContestForm.tournamentId ||
                Number(createContestForm.teams || 0) < 2 ||
                !canCreateWithMatches
              }
              onClick={async () => {
                try {
                  setIsSavingContest(true)
                  setIsLoading(true)
                  setErrorText('')
                  setNotice('')
                  const createdContestResponse = await createAdminContest({
                    ...createContestForm,
                    maxParticipants: Number(createContestForm.teams || 0),
                    createdBy: currentUserId || currentUser?.email || 'admin',
                    matchIds: selectedContestMatchIds,
                    startAt: createContestForm.startAt
                      ? new Date(createContestForm.startAt).toISOString()
                      : null,
                  })
                  const createdContest = normalizeContestRow(
                    createdContestResponse?.contest || createdContestResponse || {},
                  )
                  const refreshed = await reloadFantasyData()
                  if (
                    createdContest.id &&
                    !refreshed?.contests?.some((item) => item.id === createdContest.id)
                  ) {
                    setContests((prev) => [
                      createdContest,
                      ...prev.filter((item) => item.id !== createdContest.id),
                    ])
                  }
                  setSelectedTournament(createContestForm.tournamentId)
                  setShowCreateContestModal(false)
                  setCreateContestForm({
                    name: '',
                    tournamentId: '',
                    game: 'Fantasy',
                    teams: 0,
                    startAt: '',
                  })
                  setContestMatchOptions([])
                  setSelectedContestMatchIds([])
                  setNotice('Contest created')
                } catch (error) {
                  setErrorText(error.message || 'Failed to create contest')
                } finally {
                  setIsLoading(false)
                  setIsSavingContest(false)
                }
              }}
            >
              {isSavingContest ? 'Creating...' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="create-contest-form">
          <label className="create-contest-field">
            <span>Tournament</span>
            <SelectField
              className="create-contest-input"
              value={createContestForm.tournamentId}
              onChange={(event) =>
                setCreateContestForm((prev) => ({
                  ...prev,
                  tournamentId: event.target.value,
                }))
              }
              options={[
                { value: '', label: 'Select tournament' },
                ...tournaments.map((item) => ({ value: item.id, label: item.name })),
              ]}
            />
          </label>
          <label className="create-contest-field">
            <span>Contest name</span>
            <input
              className="create-contest-input"
              type="text"
              value={createContestForm.name}
              onChange={(event) =>
                setCreateContestForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </label>
          <label className="create-contest-field">
            <span>Max players</span>
            <input
              className="create-contest-input"
              type="number"
              min="2"
              value={createContestForm.teams}
              onChange={(event) =>
                setCreateContestForm((prev) => ({
                  ...prev,
                  teams: Number(event.target.value || 0),
                }))
              }
            />
            {Number(createContestForm.teams || 0) > 0 &&
            Number(createContestForm.teams || 0) < 2 ? (
              <small className="error-text">Max players must be at least 2.</small>
            ) : null}
          </label>
          <label className="create-contest-field">
            <span>Starts at</span>
            <input
              className="create-contest-input"
              type="datetime-local"
              value={createContestForm.startAt}
              onChange={(event) =>
                setCreateContestForm((prev) => ({
                  ...prev,
                  startAt: event.target.value,
                }))
              }
            />
            <small className="team-note">
              Leave empty to keep the contest open until an admin starts it manually.
            </small>
          </label>
          <div className="create-contest-field create-contest-matches-field">
            <span>Matches in this contest</span>
            <div className="create-contest-match-actions">
              <Button
                variant="ghost"
                size="small"
                disabled={!contestMatchOptions.length}
                onClick={() =>
                  setSelectedContestMatchIds(contestMatchOptions.map((item) => item.id))
                }
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="small"
                disabled={!selectedContestMatchIds.length}
                onClick={() => setSelectedContestMatchIds([])}
              >
                Clear
              </Button>
              <small className="team-note">
                Selected {selectedContestMatchIds.length} / {contestMatchOptions.length}
              </small>
            </div>
            <div
              className="create-contest-match-grid"
              role="group"
              aria-label="Contest matches"
            >
              {isLoadingContestMatchOptions ? (
                <p className="team-note">Loading matches...</p>
              ) : contestMatchOptions.length ? (
                contestMatchOptions.map((match) => {
                  const checked = selectedContestMatchIds.includes(match.id)
                  return (
                    <label key={match.id} className="create-contest-match-row">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedContestMatchIds((prev) =>
                              prev.includes(match.id) ? prev : [...prev, match.id],
                            )
                          } else {
                            setSelectedContestMatchIds((prev) =>
                              prev.filter((id) => id !== match.id),
                            )
                          }
                        }}
                      />
                      <span>
                        {formatCompactMatchLabel(match)}
                        <small>
                          {formatLocalMatchOptionDate(match.startAt || match.date)} -{' '}
                          {match.status}
                        </small>
                        <PlayingXiModalLink
                          tournamentId={selectedTournament}
                          matchId={match.id}
                          className="inline-playing-xi-link"
                        />
                      </span>
                    </label>
                  )
                })
              ) : (
                <p className="team-note">No matches available for this tournament.</p>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </section>
  )
}

export default FantasyHub
