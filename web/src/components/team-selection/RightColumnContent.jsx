import PlayerLabel from './PlayerLabel.jsx'

function RightColumnContent({ selected, counts, backups }) {
  return (
    <>
      <aside className="myxi-card">
        <div className="myxi-header">
          <h3>MyXI Picks</h3>
          <span className="count-pill">{selected.length} / 11</span>
        </div>
        <div className="myxi-meta">
          <span>BAT: {counts.BAT}</span>
          <span>BOWL: {counts.BOWL}</span>
          <span>WK: {counts.WK}</span>
          <span>ALL: {counts.AR}</span>
        </div>
        <div className="myxi-slots">
          {selected.length === 0 && <p className="empty">No players selected</p>}
          {selected.map((player) => (
            <PlayerLabel key={player.id} player={player} />
          ))}
        </div>
      </aside>

      <div className="backups-card">
        <div className="backups-title">
          <h4>Backups</h4>
          <span className="backup-note">Select B to add</span>
        </div>
        <div className="backups-grid">
          {[...Array(6)].map((_, index) => {
            const player = backups[index]
            return player ? (
              <PlayerLabel key={`bb-${index}`} player={player} className="backup-chip" />
            ) : (
              <div className="backup-chip empty" key={`bb-${index}`}>
                <span>Empty</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

export default RightColumnContent
