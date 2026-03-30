import PlayerLabel from './PlayerLabel.jsx'

function PlayerTile({
  player,
  isSelected,
  isBackup,
  lineupStatus = '',
  onToggle,
  onBackup,
  disabled = false,
}) {
  return (
    <div
      className={`player-tile ${isSelected ? 'selected' : ''} ${isBackup ? 'backup-selected' : ''} ${lineupStatus ? `lineup-${lineupStatus}` : ''}`.trim()}
    >
      {!!lineupStatus && (
        <span
          className={`lineup-status-light ${lineupStatus}`.trim()}
          title={lineupStatus === 'playing' ? 'In announced playing XI' : 'Not in announced playing XI'}
          aria-label={lineupStatus === 'playing' ? 'In announced playing XI' : 'Not in announced playing XI'}
        />
      )}
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
          disabled={disabled || isSelected}
          title="Add to backups"
        >
          {isBackup ? '–' : 'B'}
        </button>
      </div>
    </div>
  )
}

export default PlayerTile
