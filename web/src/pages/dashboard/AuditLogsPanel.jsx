import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import { getStoredUser } from '../../lib/auth.js'
import { deleteAuditLogs, fetchDashboardPageLoadData } from '../../lib/api.js'

function toLocalDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function AuditLogsPanel({ rows, tournaments }) {
  const currentUser = getStoredUser()
  const canDeleteAuditLogs = currentUser?.role === 'master_admin'
  const [tournamentFilter, setTournamentFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [localRows, setLocalRows] = useState(rows || [])
  const [selectedIds, setSelectedIds] = useState([])
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  useEffect(() => {
    setLocalRows(rows || [])
  }, [rows])
  const tournamentNameMap = useMemo(
    () =>
      (tournaments || []).reduce((acc, item) => {
        acc[item.id] = item.name
        return acc
      }, {}),
    [tournaments],
  )

  const actionTypes = useMemo(
    () =>
      ['all', ...Array.from(new Set((localRows || []).map((row) => row.module).filter(Boolean)))],
    [localRows],
  )

  const filteredRows = useMemo(
    () =>
      (localRows || []).filter((row) => {
        const tournamentOk =
          tournamentFilter === 'all' || (row.tournamentId || 'global') === tournamentFilter
        const actionOk = actionFilter === 'all' || row.module === actionFilter
        const needle = searchText.toString().trim().toLowerCase()
        const searchOk =
          !needle ||
          [
            row.at,
            row.actor,
            row.action,
            row.detail,
            row.target,
            row.module,
            row.tournamentId,
            tournamentNameMap[row.tournamentId],
          ]
            .filter(Boolean)
            .some((value) => value.toString().toLowerCase().includes(needle))
        return tournamentOk && actionOk && searchOk
      }),
    [actionFilter, localRows, searchText, tournamentFilter, tournamentNameMap],
  )

  const selectedVisibleIds = useMemo(
    () =>
      filteredRows
        .map((row) => String(row.id))
        .filter((id) => selectedIds.includes(id)),
    [filteredRows, selectedIds],
  )
  const allVisibleSelected =
    filteredRows.length > 0 && selectedVisibleIds.length === filteredRows.length

  const toggleSelectedId = (id) => {
    const normalizedId = String(id)
    setSelectedIds((prev) =>
      prev.includes(normalizedId)
        ? prev.filter((value) => value !== normalizedId)
        : [...prev, normalizedId],
    )
  }

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredRows.map((row) => String(row.id))
    if (!visibleIds.length) return
    setSelectedIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.includes(id))
      if (allSelected) {
        return prev.filter((id) => !visibleIds.includes(id))
      }
      return Array.from(new Set([...prev, ...visibleIds]))
    })
  }

  const onDeleteSelected = async () => {
    if (!selectedIds.length || isDeleting) return
    if (
      !window.confirm(
        `Delete ${selectedIds.length} audit log${selectedIds.length === 1 ? '' : 's'}? This cannot be undone.`,
      )
    ) {
      return
    }
    try {
      setIsDeleting(true)
      setErrorText('')
      setSuccessText('')
      await deleteAuditLogs({
        ids: selectedIds,
        actorUserId: currentUser?.userId || currentUser?.gameName || currentUser?.email || '',
      })
      const refreshed = await fetchDashboardPageLoadData()
      const nextRows = refreshed?.auditLogs || []
      setLocalRows(nextRows)
      setSelectedIds([])
      setSuccessText(`Deleted ${selectedIds.length} audit log${selectedIds.length === 1 ? '' : 's'}.`)
    } catch (error) {
      setErrorText(error.message || 'Failed to delete selected audit logs')
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = [
    ...(canDeleteAuditLogs
      ? [
          {
            key: 'select',
            label: (
              <input
                type="checkbox"
                aria-label="Select all visible audit logs"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
              />
            ),
            sortable: false,
            hideSortIcon: true,
            render: (row) => (
              <input
                type="checkbox"
                aria-label={`Select audit log ${row.id}`}
                checked={selectedIds.includes(String(row.id))}
                onChange={() => toggleSelectedId(row.id)}
              />
            ),
          },
        ]
      : []),
    {
      key: 'at',
      label: 'When',
      sortValue: (row) => row.at || '',
      render: (row) => toLocalDateTime(row.at),
    },
    { key: 'actor', label: 'Actor', render: (row) => row.actor || '-' },
    { key: 'action', label: 'Action', render: (row) => row.action || '-' },
    {
      key: 'scope',
      label: 'Tournament',
      render: (row) =>
        tournamentNameMap[row.tournamentId] ||
        (row.tournamentId === 'global' ? 'Global' : row.tournamentId || 'Global'),
    },
    {
      key: 'detail',
      label: 'Details',
      sortable: false,
      hideSortIcon: true,
      render: (row) => row.detail || row.target || '-',
    },
  ]

  return (
    <section className="dashboard-section">
      <div className="admin-card dashboard-panel-card audit-logs-panel">
        <div className="dashboard-empty-state">
          <h3>What Audit Logs track</h3>
          <p>
            Audit Logs capture admin/master actions such as role changes, tournament/contest
            changes, scoring updates, manual overrides, and admin/master sign-ins.
          </p>
          <p>
            Player sign-ins are not captured currently; this view is focused on privileged actions.
          </p>
        </div>
        {canDeleteAuditLogs && (
          <div className="top-actions audit-logs-actions">
            <span className="team-note">
              {selectedIds.length
                ? `${selectedIds.length} selected`
                : 'Select audit rows to delete'}
            </span>
            <Button
              type="button"
              variant="danger"
              size="small"
              disabled={!selectedIds.length || isDeleting}
              onClick={onDeleteSelected}
            >
              {isDeleting ? 'Deleting...' : 'Delete selected'}
            </Button>
          </div>
        )}
        {!!successText && <p className="success-text">{successText}</p>}
        {!!errorText && <p className="error-text">{errorText}</p>}
        <div className="module-filters compact">
          <select
            value={tournamentFilter}
            onChange={(event) => setTournamentFilter(event.target.value)}
          >
            <option value="all">All tournaments</option>
            <option value="global">Global</option>
            {(tournaments || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            {actionTypes.map((item) => (
              <option key={item} value={item}>
                {item === 'all' ? 'All actions' : item}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search date, actor, action, target..."
            aria-label="Search audit logs"
          />
        </div>

        <StickyTable
          columns={columns}
          rows={filteredRows}
          rowKey={(row) => row.id}
          emptyText="No audit logs found for selected filters"
          wrapperClassName="catalog-table-wrap"
          tableClassName="catalog-table"
        />
      </div>
    </section>
  )
}

export default AuditLogsPanel
