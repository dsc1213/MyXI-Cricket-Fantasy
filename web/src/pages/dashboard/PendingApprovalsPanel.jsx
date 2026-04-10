import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button.jsx'
import StickyTable from '../../components/ui/StickyTable.jsx'
import { fetchAdminUsers, updateAdminUser } from '../../lib/api.js'
import { getStoredUser } from '../../lib/auth.js'

function PendingApprovalsPanel({ compact = false }) {
  const normalizeAdminUsers = (payload) => {
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.users)) return payload.users
    if (Array.isArray(payload?.rows)) return payload.rows
    return []
  }

  const currentUser = getStoredUser()
  const [isLoading, setIsLoading] = useState(true)
  const [errorText, setErrorText] = useState('')
  const [notice, setNotice] = useState('')
  const [users, setUsers] = useState([])
  const [isSavingId, setIsSavingId] = useState(null)

  const loadPending = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorText('')
      const rows = await fetchAdminUsers()
      setUsers(normalizeAdminUsers(rows))
    } catch (error) {
      setErrorText(error.message || 'Failed to load pending users')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  const pendingUsers = useMemo(
    () => (users || []).filter((row) => row.status === 'pending'),
    [users],
  )

  const onApprove = async (row, status) => {
    try {
      setErrorText('')
      setNotice('')
      setIsSavingId(row.id)
      await updateAdminUser({
        id: row.id,
        payload: {
          status,
          actorUserId:
            currentUser?.userId || currentUser?.gameName || currentUser?.email || '',
        },
      })
      await loadPending()
      setNotice(status === 'active' ? 'User approved' : 'User rejected')
    } catch (error) {
      setErrorText(error.message || 'Failed to update user approval')
    } finally {
      setIsSavingId(null)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <Link className="leaderboard-link" to={`/users/${row.id}`}>
          {row.name}
        </Link>
      ),
    },
    {
      key: 'userId',
      label: 'User ID',
      render: (row) => row.userId || row.gameName || '-',
    },
    { key: 'email', label: 'Email', render: (row) => row.email || '-' },
    { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
    { key: 'location', label: 'Location', render: (row) => row.location || '-' },
    {
      key: 'joinedAt',
      label: 'Created',
      render: (row) => (row.joinedAt ? new Date(row.joinedAt).toLocaleString() : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="top-actions">
          <Button
            variant="primary"
            size="small"
            disabled={isSavingId === row.id}
            onClick={(event) => {
              event.stopPropagation()
              void onApprove(row, 'active')
            }}
          >
            Approve
          </Button>
          <Button
            variant="danger"
            size="small"
            disabled={isSavingId === row.id}
            onClick={(event) => {
              event.stopPropagation()
              void onApprove(row, 'rejected')
            }}
          >
            Reject
          </Button>
        </div>
      ),
    },
  ]

  return (
    <section
      className={`dashboard-section ${compact ? 'pending-approvals-section compact' : 'pending-approvals-section'}`.trim()}
    >
      <div
        className={`admin-card dashboard-panel-card ${compact ? 'pending-approvals-panel compact' : 'pending-approvals-panel'}`.trim()}
      >
        <div className="contest-section-head">
          <h3>{`Pending users (${pendingUsers.length})`}</h3>
          <div className="top-actions">
            <Button variant="ghost" size="small" onClick={() => void loadPending()}>
              Refresh
            </Button>
          </div>
        </div>
        {!!errorText && <p className="error-text">{errorText}</p>}
        {!!notice && <p className="success-text">{notice}</p>}
        {isLoading ? (
          <p className="team-note">Loading pending users...</p>
        ) : (
          <StickyTable
            columns={columns}
            rows={pendingUsers}
            rowKey={(row) => row.id}
            emptyText="No pending users"
            wrapperClassName="catalog-table-wrap"
            tableClassName="catalog-table pending-approvals-table"
          />
        )}
      </div>
    </section>
  )
}

export default PendingApprovalsPanel
