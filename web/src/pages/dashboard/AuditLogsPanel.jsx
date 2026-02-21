import { useMemo, useState } from 'react'
import StickyTable from '../../components/ui/StickyTable.jsx'

function toLocalDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function AuditLogsPanel({ rows, tournaments }) {
  const [tournamentFilter, setTournamentFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const tournamentNameMap = useMemo(
    () =>
      (tournaments || []).reduce((acc, item) => {
        acc[item.id] = item.name
        return acc
      }, {}),
    [tournaments],
  )

  const actionTypes = useMemo(
    () => ['all', ...Array.from(new Set((rows || []).map((row) => row.module).filter(Boolean)))],
    [rows],
  )

  const filteredRows = useMemo(
    () =>
      (rows || []).filter((row) => {
        const tournamentOk =
          tournamentFilter === 'all' || (row.tournamentId || 'global') === tournamentFilter
        const actionOk = actionFilter === 'all' || row.module === actionFilter
        return tournamentOk && actionOk
      }),
    [rows, tournamentFilter, actionFilter],
  )

  const columns = [
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
