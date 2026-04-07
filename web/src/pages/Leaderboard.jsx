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
  const [allJoinedContests, setAllJoinedContests] = useState([])
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

  useEffect(() => {
    let active = true

    const loadContests = async () => {
      try {
        const [data, tournaments, routeContestData] = await Promise.all([
          fetchContests({ joined: true, userId: currentUserId }),
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
        setAllJoinedContests(data || [])
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
      ? allJoinedContests
      : allJoinedContests.filter((item) => item.tournamentId === selectedTournamentId)
    if (
      routeContest &&
      (!selectedTournamentId || routeContest.tournamentId === selectedTournamentId) &&
      !base.some((item) => item.id === routeContest.id)
    ) {
      return [...base, routeContest]
    }
    return base
  }, [allJoinedContests, selectedTournamentId, routeContest])

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
  const normalizedCurrentGameName = (currentUserId || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const compareRow =
    rows.find(
      (row) =>
        (row.userId || '')
          .toString()
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') === normalizedCurrentGameName,
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
    { key: 'points', label: 'Points' },
  ]

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
    </section>
  )
}

export default Leaderboard
