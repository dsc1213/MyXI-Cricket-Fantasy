import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchPlayerStats, fetchTournaments } from '../lib/api.js'
import TournamentPageTabs from '../components/TournamentPageTabs.jsx'
import PlayerIdentity from '../components/ui/PlayerIdentity.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import StickyTable from '../components/ui/StickyTable.jsx'

function CricketerStats() {
  const { tournamentId: routeTournamentId } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [tournaments, setTournaments] = useState([])
  const [selectedTournamentId, setSelectedTournamentId] = useState(routeTournamentId || '')
  const [rows, setRows] = useState([])
  const [searchText, setSearchText] = useState('')

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
        row.name,
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
  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Player',
        sortValue: (row) => row.name || '',
        headerClassName: 'cricketer-col-player',
        cellClassName: 'cricketer-col-player',
        render: (row) => (
          <PlayerIdentity
            name={row.name}
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
        render: (row) => <strong>{Number(row.points || 0)}</strong>,
      },
    ],
    [],
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
          />
        </div>
      </article>
    </section>
  )
}

export default CricketerStats
