import AdminManagerPanel from './AdminManagerPanel.jsx'
import PendingApprovalsPanel from './PendingApprovalsPanel.jsx'

function UserManagerPanel({ showPending = true }) {
  return (
    <section className="dashboard-section user-manager-layout">
      <div className="user-manager-primary">
        <AdminManagerPanel initialTab="users" hideTabs />
      </div>
      {showPending ? (
        <div className="user-manager-secondary">
          <PendingApprovalsPanel compact />
        </div>
      ) : null}
    </section>
  )
}

export default UserManagerPanel
