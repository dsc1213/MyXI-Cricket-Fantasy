import { Link } from 'react-router-dom'

function Home() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Fantasy cricket tournaments</p>
        <h1>Build a fantasy league for your friends in minutes.</h1>
        <p className="lead">
          Pick tournaments, create contests, and track scores with simple admin
          tools. Manual score overrides keep things accurate after each match.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="cta">
            Create account
          </Link>
          <Link to="/login" className="ghost">
            I already have an account
          </Link>
        </div>
      </div>
      <div className="hero-card">
        <div className="card-header">
          <span>Sample Live Snapshot</span>
          <span className="badge">Preview</span>
        </div>
        <div className="scoreline">
          <div>
            <strong>Team A</strong> 168/4
          </div>
          <span>18.2 overs</span>
        </div>
        <div className="stat-grid">
          <div>
            <p>Run Rate</p>
            <strong>9.16</strong>
          </div>
          <div>
            <p>Last 5</p>
            <strong>54/1</strong>
          </div>
          <div>
            <p>Next Update</p>
            <strong>00:45</strong>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Home
