import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ApiFailureTile from '../components/ui/ApiFailureTile.jsx'
import Button from '../components/ui/Button.jsx'
import LoadingNote from '../components/ui/LoadingNote.jsx'
import Modal from '../components/ui/Modal.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import { getStatusClassName } from '../components/ui/status.js'
import {
  createAdminContest,
  fetchContestMatchOptions,
  fetchContests,
  fetchTournaments,
  joinContest,
} from '../lib/api.js'
import { getStoredUser } from '../lib/auth.js'

const tournamentPalette = [
  '#0f7a67',
  '#2f66e9',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#0e7490',
]

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
  const [createContestForm, setCreateContestForm] = useState({
    name: '',
    tournamentId: '',
    game: 'Fantasy',
    teams: 0,
    status: 'Open',
  })

  const currentUser = getStoredUser()
  const currentUserId = currentUser?.userId || currentUser?.gameName || currentUser?.email || ''
  const isAdminUser = ['admin', 'master_admin'].includes(currentUser?.role)

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
        setTournaments(tournamentsRes)
        setContests(contestsRes)
        setSelectedTournament((prev) =>
          tournamentsRes.some((item) => item.id === prev) ? prev : tournamentsRes[0]?.id || '',
        )
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
  }, [currentUserId])

  const reloadFantasyData = async () => {
    const [tournamentsRes, contestsRes] = await Promise.all([
      fetchTournaments(),
      fetchContests({ game: 'Fantasy', userId: currentUserId }),
    ])
    setTournaments(tournamentsRes)
    setContests(contestsRes)
    setSelectedTournament((prev) =>
      tournamentsRes.some((item) => item.id === prev) ? prev : tournamentsRes[0]?.id || '',
    )
  }

  const tournamentNameMap = useMemo(() => {
    return tournaments.reduce((acc, item) => {
      acc[item.id] = item.name
      return acc
    }, {})
  }, [tournaments])

  const tournamentContests = useMemo(() => {
    return contests.filter((contest) => {
      if (contest.mode === 'fixed_roster') return false
      const tournamentOk = selectedTournament && contest.tournamentId === selectedTournament
      const statusOk = selectedStatus === 'all' || contest.status === selectedStatus
      return tournamentOk && statusOk
    })
  }, [contests, selectedTournament, selectedStatus])

  const availableContests = useMemo(
    () => tournamentContests.filter((contest) => !contest.joined),
    [tournamentContests],
  )
  const joinedContests = useMemo(
    () => tournamentContests.filter((contest) => contest.joined),
    [tournamentContests],
  )

  const selectedTournamentName =
    tournamentNameMap[selectedTournament] || selectedTournament || 'Tournament'
  const showApiFailureTile =
    !isLoading && !!errorText && tournaments.length === 0 && contests.length === 0
  const canCreateContest = !isLoading && tournaments.length > 0
  const selectableMatchOptions = useMemo(
    () => contestMatchOptions.filter((item) => item.selectable),
    [contestMatchOptions],
  )
  const canCreateWithMatches = selectedContestMatchIds.length > 0

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
        const selectableIds = (rows || [])
          .filter((item) => item.selectable)
          .map((item) => item.id)
        setContestMatchOptions(rows || [])
        setSelectedContestMatchIds((prev) => {
          const next = prev.filter((id) => selectableIds.includes(id))
          if (next.length) return next
          return selectableIds
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
    <section className="admin">
      <div className="section-head-compact">
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
        <LoadingNote loading={isLoading} errorText={showApiFailureTile ? '' : errorText} />
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
            <div className="tournament-tile-grid">
              {tournaments.map((item, index) => (
                <article
                  key={item.id}
                  className={`team-card tournament-card tournament-filter-tile ${selectedTournament === item.id ? 'active' : ''}`.trim()}
                  style={{
                    '--tournament-color': tournamentPalette[index % tournamentPalette.length],
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
                        {(contestsByTournament[item.id] || []).length} contests available
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
          </div>

          <div className="fantasy-hub-main">
            <div className="flow-breadcrumb">
              <span>Fantasy</span>
              <span>/</span>
              <strong>{selectedTournamentName}</strong>
            </div>

            <div className="module-filters compact fantasy-status-filter">
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

            <div className="fantasy-contest-sections">
              <div>
                <div className="contest-section-head">
                  <h3>{`Available (${availableContests.length})`}</h3>
                </div>
                <div className="compact-card-grid contest-discovery-grid">
                  {availableContests.map((contest) => {
                    const joinedCount = Number(contest.joinedCount ?? contest.participants ?? 0)
                    const maxPlayers = Number(contest.maxPlayers ?? contest.teams ?? 0)
                    return (
                      <article
                        className={`compact-contest-card fantasy ${getStatusClassName(contest.status)}`.trim()}
                        key={contest.id}
                      >
                        <div className="contest-card-top">
                          <strong>{contest.name}</strong>
                          <span className={`contest-status-text ${getStatusClassName(contest.status)}`.trim()}>
                            {contest.status}
                          </span>
                        </div>
                        <p className="team-note">{tournamentNameMap[contest.tournamentId]}</p>
                        <p className="team-note">{contest.teams} teams</p>
                        <p className="team-note">
                          Participants {joinedCount}
                          {maxPlayers > 0
                            ? ` / ${maxPlayers}`
                            : ''}
                        </p>
                        <p className="team-note">
                          Last score update:{' '}
                          {contest.lastScoreUpdatedAt
                            ? new Date(contest.lastScoreUpdatedAt).toLocaleString()
                            : '-'}
                        </p>
                        <div className="contest-card-bottom">
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
                                setErrorText(error.message || 'Failed to join contest')
                              }
                            }}
                          >
                            {contest.hasCapacity === false
                              ? 'Contest full'
                              : contest.joinOpen === false
                                ? 'Started'
                                : 'Join'}
                          </Button>
                          <Link
                            className="ghost small"
                            to={`/tournaments/${contest.tournamentId}/contests/${contest.id}`}
                          >
                            Open contest
                          </Link>
                        </div>
                      </article>
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
                    const joinedCount = Number(contest.joinedCount ?? contest.participants ?? 0)
                    const maxPlayers = Number(contest.maxPlayers ?? contest.teams ?? 0)
                    return (
                      <article
                        className={`compact-contest-card fantasy ${getStatusClassName(contest.status)}`.trim()}
                        key={contest.id}
                      >
                        <div className="contest-card-top">
                          <strong>{contest.name}</strong>
                          <span className={`contest-status-text ${getStatusClassName(contest.status)}`.trim()}>
                            {contest.status}
                          </span>
                        </div>
                        <p className="team-note">{tournamentNameMap[contest.tournamentId]}</p>
                        <p className="team-note">{contest.teams} teams</p>
                        <p className="team-note">
                          Participants {joinedCount}
                          {maxPlayers > 0
                            ? ` / ${maxPlayers}`
                            : ''}
                        </p>
                        <p className="team-note">
                          Last score update:{' '}
                          {contest.lastScoreUpdatedAt
                            ? new Date(contest.lastScoreUpdatedAt).toLocaleString()
                            : '-'}
                        </p>
                        <div className="contest-card-bottom">
                          <Link
                            className="ghost small"
                            to={`/tournaments/${contest.tournamentId}/contests/${contest.id}`}
                          >
                            Open contest
                          </Link>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            </div>
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
                !canCreateWithMatches
              }
              onClick={async () => {
                try {
                  setIsSavingContest(true)
                  setErrorText('')
                  setNotice('')
                  await createAdminContest({
                    ...createContestForm,
                    createdBy: currentUserId || currentUser?.email || 'admin',
                    matchIds: selectedContestMatchIds,
                  })
                  await reloadFantasyData()
                  setSelectedTournament(createContestForm.tournamentId)
                  setShowCreateContestModal(false)
                  setCreateContestForm({
                    name: '',
                    tournamentId: '',
                    game: 'Fantasy',
                    teams: 0,
                    status: 'Open',
                  })
                  setContestMatchOptions([])
                  setSelectedContestMatchIds([])
                  setNotice('Contest created')
                } catch (error) {
                  setErrorText(error.message || 'Failed to create contest')
                } finally {
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
              min="0"
              value={createContestForm.teams}
              onChange={(event) =>
                setCreateContestForm((prev) => ({
                  ...prev,
                  teams: Number(event.target.value || 0),
                }))
              }
            />
          </label>
          <label className="create-contest-field">
            <span>Status</span>
            <SelectField
              className="create-contest-input"
              value={createContestForm.status}
              onChange={(event) =>
                setCreateContestForm((prev) => ({
                  ...prev,
                  status: event.target.value,
                }))
              }
              options={[
                { value: 'Open', label: 'Open' },
                { value: 'Starting Soon', label: 'Starting Soon' },
                { value: 'Locked', label: 'Locked' },
                { value: 'Completed', label: 'Completed' },
              ]}
            />
          </label>
          <div className="create-contest-field create-contest-matches-field">
            <span>Matches in this contest</span>
            <div className="create-contest-match-actions">
              <Button
                variant="ghost"
                size="small"
                disabled={!selectableMatchOptions.length}
                onClick={() =>
                  setSelectedContestMatchIds(selectableMatchOptions.map((item) => item.id))
                }
              >
                Select all open
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
                Selected {selectedContestMatchIds.length} / {selectableMatchOptions.length}
              </small>
            </div>
            <div className="create-contest-match-grid" role="group" aria-label="Contest matches">
              {isLoadingContestMatchOptions ? (
                <p className="team-note">Loading matches...</p>
              ) : contestMatchOptions.length ? (
                contestMatchOptions.map((match) => {
                  const checked = selectedContestMatchIds.includes(match.id)
                  return (
                    <label
                      key={match.id}
                      className={`create-contest-match-row ${match.selectable ? '' : 'disabled'}`.trim()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!match.selectable}
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
                        Match {match.matchNo}: {match.name}
                        <small>
                          {match.date} - {match.status}
                        </small>
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
