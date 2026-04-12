import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import { getStoredUser } from '../../lib/auth.js'
import {
  confirmPendingContestRemoval,
  confirmPendingTournamentRemoval,
  fetchPendingContestRemovals,
  fetchPendingTournamentRemovals,
  rejectPendingContestRemoval,
  rejectPendingTournamentRemoval,
} from '../../lib/api.js'

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function PendingRemovalsPanel() {
  const currentUser = getStoredUser()
  const [rows, setRows] = useState([])
  const [searchText, setSearchText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  const loadRows = async () => {
    try {
      setIsLoading(true)
      setErrorText('')
      const [contestPayload, tournamentPayload] = await Promise.all([
        fetchPendingContestRemovals(),
        fetchPendingTournamentRemovals(),
      ])
      setRows([
        ...(Array.isArray(contestPayload) ? contestPayload : []),
        ...(Array.isArray(tournamentPayload) ? tournamentPayload : []),
      ])
    } catch (error) {
      setErrorText(error.message || 'Failed to load pending removals')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadRows()
  }, [])

  const filteredRows = useMemo(() => {
    const needle = searchText.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [
        row.resourceType,
        row.resourceName,
        row.contestName,
        row.tournamentName,
        row.requestedByGameName,
        row.requestedByName,
        row.requestedBy,
        row.requestedAt,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    )
  }, [rows, searchText])

  const onConfirmDelete = async (row) => {
    try {
      const nextBusyKey = `${row.resourceType}:${row.resourceId}`
      setBusyKey(nextBusyKey)
      setErrorText('')
      setSuccessText('')
      const actorId = currentUser?.userId || currentUser?.gameName || currentUser?.email || ''
      if (row.resourceType === 'tournament') {
        await confirmPendingTournamentRemoval(row.resourceId, actorId)
      } else {
        await confirmPendingContestRemoval(row.resourceId, actorId)
      }
      await loadRows()
      setSuccessText(`${row.resourceType === 'tournament' ? 'Tournament' : 'Contest'} permanently deleted`)
    } catch (error) {
      setErrorText(error.message || 'Failed to confirm delete')
    } finally {
      setBusyKey('')
    }
  }

  const onRejectDelete = async (row) => {
    try {
      const nextBusyKey = `${row.resourceType}:${row.resourceId}`
      setBusyKey(nextBusyKey)
      setErrorText('')
      setSuccessText('')
      const actorId = currentUser?.userId || currentUser?.gameName || currentUser?.email || ''
      if (row.resourceType === 'tournament') {
        await rejectPendingTournamentRemoval(row.resourceId, actorId)
      } else {
        await rejectPendingContestRemoval(row.resourceId, actorId)
      }
      await loadRows()
      setSuccessText(`${row.resourceType === 'tournament' ? 'Tournament' : 'Contest'} restored`)
    } catch (error) {
      setErrorText(error.message || 'Failed to restore item')
    } finally {
      setBusyKey('')
    }
  }

  const columns = [
    {
      key: 'resourceType',
      label: 'Type',
      render: (row) => (row.resourceType === 'tournament' ? 'Tournament' : 'Contest'),
    },
    {
      key: 'contestName',
      label: 'Name',
      render: (row) => row.resourceName || row.contestName || row.tournamentName || '-',
    },
    {
      key: 'tournamentName',
      label: 'Tournament',
      render: (row) => row.tournamentName || row.tournamentId || '-',
    },
    {
      key: 'requestedBy',
      label: 'Requested by',
      render: (row) => row.requestedByGameName || row.requestedByName || row.requestedBy || '-',
    },
    {
      key: 'requestedAt',
      label: 'Requested at',
      render: (row) => formatDateTime(row.requestedAt),
    },
    {
      key: 'impact',
      label: 'Impact',
      sortable: false,
      hideSortIcon: true,
      render: (row) => {
        const impact = row.impactSummary || {}
        if (row.resourceType === 'tournament') {
          return `${impact.matchCount || 0} matches · ${impact.contestCount || 0} contests · ${impact.scoreRowsCount || 0} scores`
        }
        return `${impact.matchCount || 0} matches · ${impact.joinedCount || 0} participants · ${impact.teamSelectionsCount || 0} teams`
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      hideSortIcon: true,
      render: (row) => (
        <div className="top-actions compact">
          <Button
            variant="danger"
            size="small"
            disabled={busyKey === `${row.resourceType}:${row.resourceId}`}
            onClick={() => void onConfirmDelete(row)}
          >
            {busyKey === `${row.resourceType}:${row.resourceId}` ? 'Working...' : 'Confirm delete'}
          </Button>
          <Button
            variant="ghost"
            size="small"
            disabled={busyKey === `${row.resourceType}:${row.resourceId}`}
            onClick={() => void onRejectDelete(row)}
          >
            Restore
          </Button>
        </div>
      ),
    },
  ]

  return (
    <section className="dashboard-section">
      <div className="admin-card dashboard-panel-card pending-removals-panel">
        <div className="contest-section-head">
          <h3>Pending removes</h3>
          <div className="top-actions">
            <input
              type="search"
              className="dashboard-text-input"
              placeholder="Search type, contest, tournament, or requester"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <Button variant="ghost" size="small" onClick={() => void loadRows()}>
              Refresh
            </Button>
          </div>
        </div>
        {!!successText && <p className="success-text">{successText}</p>}
        {!!errorText && <p className="error-text">{errorText}</p>}
        {isLoading ? (
          <p className="team-note">Loading pending removes...</p>
        ) : (
          <StickyTable
            columns={columns}
            rows={filteredRows}
            rowKey={(row) => row.id || row.contestId}
            emptyText="No pending removes"
            wrapperClassName="catalog-table-wrap"
            tableClassName="catalog-table"
          />
        )}
      </div>
    </section>
  )
}

export default PendingRemovalsPanel
