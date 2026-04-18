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
  const playedPreviousMatch = Boolean(player?.lastMatch?.played)

  return (
    <div
      className={`player-tile ${playedPreviousMatch ? 'played-previous-match' : ''} ${isSelected ? 'selected' : ''} ${isBackup ? 'backup-selected' : ''} ${lineupStatus ? `lineup-${lineupStatus}` : ''}`.trim()}
    >
      {(lineupStatus || playedPreviousMatch) && (
        <span
          className={`lineup-status-light ${lineupStatus || 'previous-played'}`.trim()}
          title={
            lineupStatus === 'playing'
              ? 'In announced playing XI'
              : lineupStatus === 'bench'
                ? 'Not in announced playing XI'
                : 'Played previous match'
          }
          aria-label={
            lineupStatus === 'playing'
              ? 'In announced playing XI'
              : lineupStatus === 'bench'
                ? 'Not in announced playing XI'
                : 'Played previous match'
          }
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
          title={isBackup ? 'Remove from backups' : 'Add to backups'}
        >
          {isBackup ? '–' : 'B'}
        </button>
      </div>
    </div>
  )
}

export default PlayerTile
