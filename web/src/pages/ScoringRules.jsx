function ScoringRules() {
  return (
    <section className="admin">
      <div className="admin-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Scoring rules</h2>
          <p className="lead">Set points for runs, wickets, catches.</p>
        </div>
        <button type="button" className="cta">
          Save rules
        </button>
      </div>
      <div className="admin-grid">
        <div className="admin-card">
          <label>
            Runs (per run)
            <input type="number" defaultValue="1" />
          </label>
          <label>
            Wickets
            <input type="number" defaultValue="20" />
          </label>
          <label>
            Catches
            <input type="number" defaultValue="10" />
          </label>
          <label>
            Fours
            <input type="number" defaultValue="1" />
          </label>
          <label>
            Sixes
            <input type="number" defaultValue="2" />
          </label>
        </div>
        <div className="admin-card admin-side-note">
          <h3>Notes</h3>
          <p>Rules apply to the selected tournament.</p>
          <div className="select-row">
            <span>Active tournament</span>
            <select>
              <option>T20 World Cup 2026</option>
              <option>IPL 2026</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ScoringRules
