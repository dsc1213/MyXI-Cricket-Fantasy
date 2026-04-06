import { Link } from 'react-router-dom'

function AdminDashboard() {
  return (
    <section className="admin">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Admin Console</p>
          <h2>Dashboard</h2>
          <p className="lead">
            Centralized admin controls across tournaments, contests, and scores.
          </p>
        </div>
      </div>
      <div className="admin-grid">
        <article className="admin-card">
          <h3>Fantasy module</h3>
          <div className="player-list">
            <div className="player-row">
              <Link className="leaderboard-link" to="/tournaments">
                Tournaments
              </Link>
            </div>
            <div className="player-row">
              <Link className="leaderboard-link" to="/admin/scoring">
                Scoring rules
              </Link>
            </div>
            <div className="player-row">
              <Link className="leaderboard-link" to="/admin/score-upload">
                Match score upload
              </Link>
            </div>
          </div>
        </article>
        <article className="admin-card">
          <h3>Future game modules</h3>
          <div className="pill-grid">
            <span>Draft</span>
            <span>Auction</span>
            <span>Pick'em</span>
          </div>
        </article>
      </div>
    </section>
  )
}

export default AdminDashboard
