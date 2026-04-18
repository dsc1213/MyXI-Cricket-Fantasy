import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchPlayerMatchBreakdown, fetchPlayerStats, fetchTournaments } from '../lib/api.js'
import TournamentPageTabs from '../components/TournamentPageTabs.jsx'
import PlayerIdentity from '../components/ui/PlayerIdentity.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import StickyTable from '../components/ui/StickyTable.jsx'

const formatStatValue = (value) => {
  const numeric = Number(value || 0)
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1)
}

const formatBreakdownDate = (value) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

const getPlayerDisplayName = (row = {}) =>
  (row.displayName || row.name || '').toString().trim()

function CricketerStats() {
  const { tournamentId: routeTournamentId } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [tournaments, setTournaments] = useState([])
  const [selectedTournamentId, setSelectedTournamentId] = useState(routeTournamentId || '')
  const [rows, setRows] = useState([])
  const [searchText, setSearchText] = useState('')
  const [expandedPlayerId, setExpandedPlayerId] = useState('')
  const [breakdownByPlayerId, setBreakdownByPlayerId] = useState({})
  const [breakdownLoadingByPlayerId, setBreakdownLoadingByPlayerId] = useState({})
  const [breakdownErrorByPlayerId, setBreakdownErrorByPlayerId] = useState({})

  useEffect(() => {
    let active = true
    const loadTournaments = async () => {
      try {
        const data = await fetchTournaments()
        if (!active) return
        setTournaments(data || [])
        setSelectedTournamentId((prev) => {
          if (prev) return prev
          if (routeTournamentId) return routeTournamentId
          return data?.[0]?.id || ''
        })
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load tournaments')
      }
    }
    loadTournaments()
    return () => {
      active = false
    }
  }, [routeTournamentId])

  useEffect(() => {
    if (!selectedTournamentId) return
    let active = true
    const loadStats = async () => {
      try {
        setIsLoading(true)
        setErrorText('')
        const data = await fetchPlayerStats({ tournamentId: selectedTournamentId })
        if (!active) return
        setRows(data || [])
      } catch (error) {
        if (!active) return
        setErrorText(error.message || 'Failed to load player stats')
      } finally {
        if (active) setIsLoading(false)
      }
    }
    loadStats()
    return () => {
      active = false
    }
  }, [selectedTournamentId])

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) => {
      const haystack = [
        getPlayerDisplayName(row),
        row.teamCode,
        row.team,
        row.teamName,
        row.role,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [rows, searchText])

  const sortedRows = useMemo(
    () => [...filteredRows].sort((a, b) => Number(b.points || 0) - Number(a.points || 0)),
    [filteredRows],
  )

  const selectedTournament = tournaments.find((item) => item.id === selectedTournamentId)
  const toggleBreakdown = useCallback(async (row) => {
    if (!row?.id || !selectedTournamentId) return
    const playerId = String(row.id)
    if (expandedPlayerId === playerId) {
      setExpandedPlayerId('')
      return
    }
    setExpandedPlayerId(playerId)
    if (Object.prototype.hasOwnProperty.call(breakdownByPlayerId, playerId)) return
    setBreakdownLoadingByPlayerId((prev) => ({ ...prev, [playerId]: true }))
    setBreakdownErrorByPlayerId((prev) => ({ ...prev, [playerId]: '' }))
    try {
      const data = await fetchPlayerMatchBreakdown({
        tournamentId: selectedTournamentId,
        playerId,
      })
      setBreakdownByPlayerId((prev) => ({
        ...prev,
        [playerId]: Array.isArray(data) ? data : [],
      }))
    } catch (error) {
      setBreakdownErrorByPlayerId((prev) => ({
        ...prev,
        [playerId]: error.message || 'Failed to load match breakdown',
      }))
    } finally {
      setBreakdownLoadingByPlayerId((prev) => ({ ...prev, [playerId]: false }))
    }
  }, [breakdownByPlayerId, expandedPlayerId, selectedTournamentId])

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Player',
        sortValue: (row) => getPlayerDisplayName(row),
        headerClassName: 'cricketer-col-player',
        cellClassName: 'cricketer-col-player',
        render: (row) => (
          <PlayerIdentity
            name={getPlayerDisplayName(row)}
            imageUrl={row.imageUrl || ''}
            className="dense cricketer-stats-player-identity"
          />
        ),
      },
      {
        key: 'team',
        label: 'Team',
        sortValue: (row) => row.teamName || row.team || '',
        headerClassName: 'cricketer-col-team',
        cellClassName: 'cricketer-col-team',
        render: (row) => (
          <div className="stats-team-cell">
            <strong>{row.teamCode || row.team || '-'}</strong>
            {row.teamName && row.teamName !== row.teamCode ? (
              <span>{row.teamName}</span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'runs',
        label: 'Runs',
        headerClassName: 'cricketer-col-primary-stat',
        cellClassName: 'cricketer-col-primary-stat',
      },
      {
        key: 'wickets',
        label: 'Wkts',
        headerClassName: 'cricketer-col-primary-stat',
        cellClassName: 'cricketer-col-primary-stat',
      },
      {
        key: 'catches',
        label: 'Catches',
        headerClassName: 'cricketer-col-secondary-stat',
        cellClassName: 'cricketer-col-secondary-stat',
        render: (row) => row.catches || 0,
      },
      {
        key: 'fours',
        label: '4s',
        headerClassName: 'cricketer-col-secondary-stat',
        cellClassName: 'cricketer-col-secondary-stat',
        render: (row) => row.fours || 0,
      },
      {
        key: 'sixes',
        label: '6s',
        headerClassName: 'cricketer-col-secondary-stat',
        cellClassName: 'cricketer-col-secondary-stat',
        render: (row) => row.sixes || 0,
      },
      {
        key: 'points',
        label: 'Points',
        sortValue: (row) => Number(row.points || 0),
        headerClassName: 'cricketer-col-points',
        cellClassName: 'cricketer-col-points',
        render: (row) => (
          <button
            type="button"
            className="cricketer-stats-points-trigger"
            onClick={(event) => {
              event.stopPropagation()
              void toggleBreakdown(row)
            }}
            aria-expanded={expandedPlayerId === String(row.id)}
            aria-label={`Show match breakdown for ${getPlayerDisplayName(row)}`}
          >
            <strong>{Number(row.points || 0)}</strong>
          </button>
        ),
      },
    ],
    [expandedPlayerId, toggleBreakdown],
  )

  return (
    <section className="admin cricketer-stats-page">
      <div className="section-head-compact">
        <div className="flow-breadcrumb">
          <Link to="/fantasy">Fantasy</Link>
          <span>/</span>
          <strong>{selectedTournament?.name || selectedTournamentId || 'Tournament'}</strong>
          <span>/</span>
          <strong>Stats</strong>
        </div>
        <h2>Cricketer Stats</h2>
        {isLoading && <p className="team-note">Loading...</p>}
        {!!errorText && <p className="error-text">{errorText}</p>}
      </div>

      <div className="module-filters compact cricketer-stats-filters">
        <SelectField
          value={selectedTournamentId}
          onChange={(event) => setSelectedTournamentId(event.target.value)}
          options={(tournaments || []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search player or team"
          aria-label="Search player stats"
        />
      </div>
      {!!selectedTournamentId && <TournamentPageTabs tournamentId={selectedTournamentId} />}

      <article className="admin-card">
        <div className="cricketer-stats-head">
          <h3>Tournament Player Points</h3>
          <Link className="ghost small" to="/home">
            Back to home
          </Link>
        </div>
        <div className="cricketer-stats-table-wrap">
          <StickyTable
            columns={columns}
            rows={sortedRows}
            rowKey={(row) => row.id}
            tableClassName="cricketer-stats-table"
            wrapperClassName="cricketer-stats-sticky-wrap"
            emptyText="No player stats"
            isRowExpanded={(row) => expandedPlayerId === String(row.id)}
            expandedRowClassName="cricketer-stats-expanded-row"
            renderExpandedRow={(row) => {
              const playerId = String(row.id)
              const breakdownRows = breakdownByPlayerId[playerId] || []
              const isBreakdownLoading = Boolean(breakdownLoadingByPlayerId[playerId])
              const breakdownErrorText = breakdownErrorByPlayerId[playerId] || ''
              const breakdownTotals = breakdownRows.reduce(
                (acc, item) => ({
                  runs: acc.runs + Number(item.runs || 0),
                  wickets: acc.wickets + Number(item.wickets || 0),
                  catches: acc.catches + Number(item.catches || 0),
                  points: acc.points + Number(item.points || 0),
                }),
                { runs: 0, wickets: 0, catches: 0, points: 0 },
              )
              return (
                <div className="cricketer-breakdown-inline" data-player-id={playerId}>
                  <div className="cricketer-breakdown-inline-head">
                    <strong>{getPlayerDisplayName(row)}</strong>
                    <span>Match by match points</span>
                  </div>
                  {isBreakdownLoading ? <p className="team-note">Loading breakdown...</p> : null}
                  {!isBreakdownLoading && breakdownErrorText ? (
                    <p className="error-text">{breakdownErrorText}</p>
                  ) : null}
                  {!isBreakdownLoading && !breakdownErrorText ? (
                    <>
                      <div className="cricketer-breakdown-table-wrap">
                        <table className="cricketer-breakdown-table">
                          <thead>
                            <tr>
                              <th className="cricketer-breakdown-col-match">Match</th>
                              <th className="cricketer-breakdown-col-stat">Runs</th>
                              <th className="cricketer-breakdown-col-stat">Wkts</th>
                              <th className="cricketer-breakdown-col-stat">Ct</th>
                              <th className="cricketer-breakdown-col-points">Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {breakdownRows.length ? (
                              breakdownRows.map((item) => (
                                <tr key={item.matchId}>
                                  <td className="cricketer-breakdown-col-match">
                                    <div className="cricketer-breakdown-match-cell">
                                      <strong>{item.matchName || '-'}</strong>
                                      <span>
                                        {formatBreakdownDate(item.startTime)}
                                        {item.status ? ` · ${item.status}` : ''}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="cricketer-breakdown-col-stat">{item.runs || 0}</td>
                                  <td className="cricketer-breakdown-col-stat">
                                    {item.wickets || 0}
                                  </td>
                                  <td className="cricketer-breakdown-col-stat">
                                    {item.catches || 0}
                                  </td>
                                  <td className="cricketer-breakdown-col-points">
                                    <strong>{formatStatValue(item.points)}</strong>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5}>No match breakdown available</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="cricketer-breakdown-total">
                        <span>Total</span>
                        <span>{formatStatValue(breakdownTotals.runs)} runs</span>
                        <span>{formatStatValue(breakdownTotals.wickets)} wkts</span>
                        <span>{formatStatValue(breakdownTotals.catches)} ct</span>
                        <strong>{formatStatValue(breakdownTotals.points)} pts</strong>
                      </div>
                    </>
                  ) : null}
                </div>
              )
            }}
          />
        </div>
      </article>
    </section>
  )
}

export default CricketerStats
