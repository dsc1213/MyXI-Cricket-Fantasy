function TeamSelection() {
  return (
    <section className="team">
      <div className="team-header">
        <div>
          <p className="eyebrow">Team Selection</p>
          <h2>Pick your playing XI + backups</h2>
          <p className="lead">
            Choose 11 players for the match and add 5–6 backups. If any player
            isn’t in the final Playing XI, backups are swapped in automatically
            after the toss.
          </p>
        </div>
        <button type="button" className="cta">
          Save team
        </button>
      </div>
      <div className="team-grid">
        <div className="team-card">
          <h3>Playing XI</h3>
          <p>Enter player IDs or names (comma-separated).</p>
          <textarea placeholder="Player 1, Player 2, Player 3..." rows="8" />
        </div>
        <div className="team-card">
          <h3>Backups (optional)</h3>
          <p>These are used if a selected player isn’t playing.</p>
          <textarea placeholder="Backup 1, Backup 2..." rows="8" />
        </div>
      </div>
      <div className="team-note">
        <strong>Tip:</strong> Order backups by priority. The system swaps from
        top to bottom.
      </div>
    </section>
  )
}

export default TeamSelection
