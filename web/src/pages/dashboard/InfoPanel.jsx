function InfoPanel({ rows }) {
  return (
    <section className="dashboard-section">
      <div className="admin-card dashboard-panel-card">
        <div className="player-list">
          {rows.length === 0 ? (
            <div className="player-row">
              <strong>No data yet</strong>
              <span>No records are available for this panel.</span>
            </div>
          ) : (
            rows.map((row) => (
              <div className="player-row" key={row.id}>
                <strong>{row.action || row.title}</strong>
                <span>{row.detail || `${row.actor} • ${row.target} • ${row.at}`}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export default InfoPanel
