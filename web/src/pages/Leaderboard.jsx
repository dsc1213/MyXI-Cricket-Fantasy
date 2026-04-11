import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import LoadingNote from '../components/ui/LoadingNote.jsx'
import Modal from '../components/ui/Modal.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import StickyTable from '../components/ui/StickyTable.jsx'
import TournamentPageTabs from '../components/TournamentPageTabs.jsx'
import {
  fetchContest,
  fetchContestLeaderboard,
  fetchContestUserMatchScores,
  fetchContestUserPlayerBreakdown,
  fetchContests,
  fetchTournaments,
} from '../lib/api.js'

const formatBreakdownDate = (value) => {
  const raw = (value || '').toString().trim()
  if (!raw) return '-'
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return '-'
  const month = parsed.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  const day = parsed.getDate()
  const hours = parsed.getHours()
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  return `${month} ${day}, ${hours}:${minutes}`
}

function Leaderboard() {
  const location = useLocation()
  const { tournamentId, contestId } = useParams()
  const queryContestId = new URLSearchParams(location.search).get('contestId') || ''
  const routeContestId = contestId || queryContestId
  const currentUser = (() => {
    const raw = localStorage.getItem('myxi-user')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })()
  const currentUserId =
    currentUser?.userId || currentUser?.gameName || currentUser?.email || ''
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [allVisibleContests, setAllVisibleContests] = useState([])
  const [routeContest, setRouteContest] = useState(null)
  const [selectedTournamentId, setSelectedTournamentId] = useState(tournamentId || '')
  const [tournamentNameMap, setTournamentNameMap] = useState({})
  const [selectedContestId, setSelectedContestId] = useState(routeContestId || '')
  const [rows, setRows] = useState([])
  const [selectedRow, setSelectedRow] = useState(null)
  const [userBreakdownRows, setUserBreakdownRows] = useState([])
  const [userBreakdownTotals, setUserBreakdownTotals] = useState({
    userPoints: 0,
    comparePoints: 0,
    delta: 0,
  })
  const [isLoadingUserBreakdown, setIsLoadingUserBreakdown] = useState(false)
  const [userBreakdownError, setUserBreakdownError] = useState('')
  const [selectedContributionRow, setSelectedContributionRow] = useState(null)
  const [playerContributionRows, setPlayerContributionRows] = useState([])
  const [playerContributionMeta, setPlayerContributionMeta] = useState({
    totalPoints: 0,
    countedPlayers: null,
    rosterSize: null,
    note: '',
    mode: '',
  })
  const [isLoadingPlayerBreakdown, setIsLoadingPlayerBreakdown] = useState(false)
  const [playerBreakdownError, setPlayerBreakdownError] = useState('')

  useEffect(() => {
    let active = true

    const loadContests = async () => {
      try {
        const [data, tournaments, routeContestData] = await Promise.all([
          fetchContests({ userId: currentUserId }),
          fetchTournaments(),
          routeContestId
            ? fetchContest(routeContestId).catch(() => null)
            : Promise.resolve(null),
        ])
        if (!active) return
        const nameMap = (tournaments || []).reduce((acc, item) => {
          acc[item.id] = item.name
          return acc
        }, {})
        setAllVisibleContests(data || [])
        setRouteContest(routeContestData || null)
        setTournamentNameMap(nameMap)
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load contests')
      }
    }

    loadContests()
    return () => {
      active = false
    }
  }, [currentUserId, routeContestId])

  useEffect(() => {
    if (tournamentId) {
      setSelectedTournamentId(tournamentId)
    }
  }, [tournamentId])

  const joinedContestOptions = useMemo(() => {
    const base = !selectedTournamentId
      ? allVisibleContests
      : allVisibleContests.filter((item) => item.tournamentId === selectedTournamentId)
    if (
      routeContest &&
      (!selectedTournamentId || routeContest.tournamentId === selectedTournamentId) &&
      !base.some((item) => item.id === routeContest.id)
    ) {
      return [...base, routeContest]
    }
    return base
  }, [allVisibleContests, selectedTournamentId, routeContest])

  useEffect(() => {
    if (routeContestId) setSelectedContestId(routeContestId)
  }, [routeContestId])

  useEffect(() => {
    if (!joinedContestOptions.length) {
      if (routeContestId) {
        setSelectedContestId(routeContestId)
      } else {
        setSelectedContestId('')
        setRows([])
      }
      setIsLoading(false)
      return
    }
    if (!joinedContestOptions.some((item) => item.id === selectedContestId)) {
      setSelectedContestId(joinedContestOptions[0].id)
    }
  }, [routeContestId, joinedContestOptions, selectedContestId])

  useEffect(() => {
    if (!selectedContestId) {
      setRows([])
      setIsLoading(false)
      return
    }
    let active = true

    const loadLeaderboard = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const data = await fetchContestLeaderboard(selectedContestId)
        if (!active) return
        setRows(data.rows || [])
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load leaderboard')
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    loadLeaderboard()
    return () => {
      active = false
    }
  }, [selectedContestId])

  const selectedContest =
    joinedContestOptions.find((item) => item.id === selectedContestId) ||
    joinedContestOptions[0]
  const selectedTournamentName =
    tournamentNameMap[selectedContest?.tournamentId] ||
    tournamentNameMap[selectedTournamentId] ||
    tournamentNameMap[tournamentId] ||
    selectedContest?.tournamentId ||
    selectedTournamentId ||
    tournamentId
  const normalizeIdentityKey = (value = '') =>
    (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
  const currentUserIdentityKeys = new Set(
    [
      currentUser?.userId,
      currentUser?.gameName,
      currentUser?.email,
      currentUserId,
    ]
      .map((value) => normalizeIdentityKey(value))
      .filter(Boolean),
  )
  const compareRow =
    rows.find(
      (row) =>
        currentUserIdentityKeys.has(normalizeIdentityKey(row.userId)) ||
        currentUserIdentityKeys.has(normalizeIdentityKey(row.gameName)) ||
        currentUserIdentityKeys.has(normalizeIdentityKey(row.name)),
    ) || null
  const compareUserId = compareRow?.userId || ''

  const onOpenUserBreakdown = async (row) => {
    try {
      setSelectedRow(row)
      setUserBreakdownError('')
      setUserBreakdownRows([])
      setIsLoadingUserBreakdown(true)
      const data = await fetchContestUserMatchScores({
        contestId: selectedContestId,
        userId: row.userId || row.id,
        compareUserId,
      })
      setUserBreakdownRows(data?.rows || [])
      setUserBreakdownTotals(
        data?.totals || { userPoints: 0, comparePoints: 0, delta: 0 },
      )
    } catch (error) {
      setUserBreakdownError(error.message || 'Failed to load user match scores')
    } finally {
      setIsLoadingUserBreakdown(false)
    }
  }

  const onOpenPlayerBreakdown = async (row) => {
    try {
      setSelectedContributionRow(row)
      setPlayerBreakdownError('')
      setPlayerContributionRows([])
      setPlayerContributionMeta({
        totalPoints: Number(row?.points || 0),
        countedPlayers: row?.countedPlayers || null,
        rosterSize: row?.rosterSize || null,
        note: '',
        mode: selectedContest?.mode || '',
      })
      setIsLoadingPlayerBreakdown(true)
      const data = await fetchContestUserPlayerBreakdown({
        contestId: selectedContestId,
        userId: row.userId || row.id,
      })
      setPlayerContributionRows(data?.rows || [])
      setPlayerContributionMeta({
        totalPoints: Number(data?.totalPoints || 0),
        countedPlayers: data?.countedPlayers ?? null,
        rosterSize: data?.rosterSize ?? null,
        note: data?.note || '',
        mode: data?.mode || selectedContest?.mode || '',
      })
    } catch (error) {
      setPlayerBreakdownError(error.message || 'Failed to load player contributions')
    } finally {
      setIsLoadingPlayerBreakdown(false)
    }
  }

  const userBreakdownColumns = useMemo(
    () => [
      {
        key: 'date',
        label: 'Date',
        render: (row) => formatBreakdownDate(row?.date),
      },
      { key: 'matchName', label: 'Fixture' },
      { key: 'status', label: 'Status' },
      {
        key: 'userPoints',
        label: 'User Pts',
        render: (row) => Number(row.userPoints || 0),
      },
      {
        key: 'comparePoints',
        label: 'My Pts',
        render: (row) => Number(row.comparePoints || 0),
      },
      { key: 'delta', label: 'Diff', render: (row) => Number(row.delta || 0) },
    ],
    [],
  )

  const columns = [
    { key: 'rank', label: 'Rank', render: (_, index) => index + 1 },
    {
      key: 'name',
      label: 'Game Name',
      render: (row) => (
        <button
          type="button"
          className="leaderboard-link button-link"
          onClick={() => onOpenUserBreakdown(row)}
        >
          {row.name}
        </button>
      ),
    },
    {
      key: 'points',
      label: 'Points',
      render: (row) => (
        <button
          type="button"
          className="leaderboard-link button-link"
          onClick={() => onOpenPlayerBreakdown(row)}
        >
          {Number(row.points || 0)}
        </button>
      ),
    },
  ]
  const playerContributionColumns = useMemo(
    () => [
      { key: 'name', label: 'Player' },
      { key: 'team', label: 'Team' },
      { key: 'role', label: 'Role' },
      {
        key: 'selectedMatches',
        label:
          playerContributionMeta.mode === 'fixed_roster' ? 'Counted In' : 'Matches',
        render: (row) =>
          Number(
            row?.countedMatches ??
              row?.selectedMatches ??
              0,
          ),
      },
      {
        key: 'points',
        label: 'Points',
        render: (row) => Number(row?.points || 0),
      },
    ],
    [playerContributionMeta.mode],
  )

  return (
    <section className="leaderboard leaderboard-page">
      <div className="section-head-compact">
        {!!tournamentId && (
          <div className="flow-breadcrumb">
            <Link to="/fantasy">Fantasy</Link>
            <span>/</span>
            <Link to={`/tournaments/${tournamentId}`}>{selectedTournamentName}</Link>
            <span>/</span>
            <strong>Leaderboard</strong>
          </div>
        )}
        <h2>Leaderboard</h2>
        <LoadingNote loading={isLoading} errorText={errorText} />
      </div>
      <div className="module-filters compact">
        <SelectField
          value={selectedTournamentId}
          onChange={(event) => setSelectedTournamentId(event.target.value)}
          options={[
            { value: '', label: 'All tournaments' },
            ...Object.entries(tournamentNameMap).map(([id, name]) => ({
              value: id,
              label: name,
            })),
          ]}
        />
        <SelectField
          value={selectedContestId}
          onChange={(event) => setSelectedContestId(event.target.value)}
          options={joinedContestOptions.map((option) => ({
            value: option.id,
            label: option.name,
          }))}
        />
      </div>
      {!!tournamentId && <TournamentPageTabs tournamentId={tournamentId} />}
      {selectedContest && (
        <div className="top-actions">
          <Link
            className="ghost small"
            to={`/tournaments/${selectedContest.tournamentId}/contests/${selectedContest.id}`}
          >
            Back to contest
          </Link>
        </div>
      )}

      <div className="leaderboard-card compact leaderboard-table-card">
        <StickyTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyText="No leaderboard rows"
          wrapperClassName="leaderboard-table-wrap"
          tableClassName="leaderboard-table"
        />
      </div>

      <Modal
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title={
          selectedRow ? `${selectedRow.name} match-by-match` : 'User score breakdown'
        }
        size="md"
        footer={
          <Button variant="ghost" size="small" onClick={() => setSelectedRow(null)}>
            Close
          </Button>
        }
      >
        {isLoadingUserBreakdown && (
          <p className="team-note">Loading score breakdown...</p>
        )}
        {!!userBreakdownError && <p className="error-text">{userBreakdownError}</p>}
        {!isLoadingUserBreakdown && !userBreakdownError && (
          <>
            <div className="leaderboard-compare-summary">
              <div className="leaderboard-compare-card">
                <small>{selectedRow?.name || 'User'}</small>
                <strong>{Number(userBreakdownTotals.userPoints || 0)}</strong>
              </div>
              <div className="leaderboard-compare-card">
                <small>{compareRow?.name || 'My score'}</small>
                <strong>{Number(userBreakdownTotals.comparePoints || 0)}</strong>
              </div>
              <div className="leaderboard-compare-card">
                <small>Difference</small>
                <strong>{Number(userBreakdownTotals.delta || 0)}</strong>
              </div>
            </div>
            <StickyTable
              columns={userBreakdownColumns}
              rows={userBreakdownRows}
              rowKey={(row) => row.matchId}
              emptyText="No match scores found"
              wrapperClassName="leaderboard-preview-table-wrap"
              tableClassName="leaderboard-table"
            />
          </>
        )}
      </Modal>

      <Modal
        open={!!selectedContributionRow}
        onClose={() => setSelectedContributionRow(null)}
        title={
          selectedContributionRow
            ? `${selectedContributionRow.name} player contributions`
            : 'Player contribution breakdown'
        }
        size="md"
        footer={
          <Button
            variant="ghost"
            size="small"
            onClick={() => setSelectedContributionRow(null)}
          >
            Close
          </Button>
        }
      >
        {isLoadingPlayerBreakdown && <p className="team-note">Loading player contributions...</p>}
        {!!playerBreakdownError && <p className="error-text">{playerBreakdownError}</p>}
        {!isLoadingPlayerBreakdown && !playerBreakdownError && (
          <>
            <div className="leaderboard-compare-summary">
              <div className="leaderboard-compare-card">
                <small>Total</small>
                <strong>{Number(playerContributionMeta.totalPoints || 0)}</strong>
              </div>
              {playerContributionMeta.mode === 'fixed_roster' && (
                <div className="leaderboard-compare-card">
                  <small>Rule</small>
                  <strong>{`${Number(playerContributionMeta.countedPlayers || 11)}/${Number(playerContributionMeta.rosterSize || 15)}`}</strong>
                </div>
              )}
            </div>
            {!!playerContributionMeta.note && (
              <p className="team-note">{playerContributionMeta.note}</p>
            )}
            <StickyTable
              columns={playerContributionColumns}
              rows={playerContributionRows}
              rowKey={(row) => row.id || row.name}
              emptyText="No player contributions found"
              wrapperClassName="leaderboard-preview-table-wrap"
              tableClassName="leaderboard-table"
            />
          </>
        )}
      </Modal>
    </section>
  )
}

export default Leaderboard
