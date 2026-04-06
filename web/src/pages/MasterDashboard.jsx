import { Link } from 'react-router-dom'

function MasterDashboard() {
  return (
    <section className="admin">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Master Admin Console</p>
          <h2>Super dashboard</h2>
          <p className="lead">
            Global controls for users, roles, tournaments, and governance.
          </p>
        </div>
      </div>
      <div className="admin-grid">
        <article className="admin-card">
          <h3>Governance</h3>
          <div className="player-list">
            <div className="player-row">
              <strong>User approvals</strong>
            </div>
            <div className="player-row">
              <strong>Role management</strong>
            </div>
            <div className="player-row">
              <strong>Tournament curation</strong>
            </div>
            <div className="player-row">
              <strong>Audit logs</strong>
            </div>
          </div>
        </article>
        <article className="admin-card">
          <h3>Quick links</h3>
          <div className="player-list">
            <div className="player-row">
              <Link className="leaderboard-link" to="/admin/dashboard">
                Open admin dashboard
              </Link>
            </div>
            <div className="player-row">
              <Link className="leaderboard-link" to="/all-pages">
                Open all pages
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

export default MasterDashboard
