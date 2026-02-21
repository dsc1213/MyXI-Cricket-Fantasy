import PlayerLabel from './PlayerLabel.jsx'

function PlayerTile({ player, isSelected, isBackup, onToggle, onBackup, disabled = false }) {
  return (
    <div
      className={`player-tile ${isSelected ? 'selected' : ''} ${isBackup ? 'backup-selected' : ''}`.trim()}
    >
      <div className="player-meta">
        <PlayerLabel player={player} />
      </div>
      <div className="tile-actions">
        <button type="button" className="tile-btn" onClick={onToggle} disabled={disabled}>
          {isSelected ? '-' : '+'}
        </button>
        <button
          type="button"
          className="tile-btn backup"
          onClick={onBackup}
          disabled={disabled}
          title="Add to backups"
        >
          {isBackup ? '–' : 'B'}
        </button>
      </div>
    </div>
  )
}

export default PlayerTile
