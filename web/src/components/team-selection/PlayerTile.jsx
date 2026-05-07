import PlayerAvatar from '../ui/PlayerAvatar.jsx'
import PlayerRoleIcon from '../ui/PlayerRoleIcon.jsx'

function normalizePlayerName(player = {}) {
  const raw =
    player?.name || player?.playerName || player?.fullName || player?.displayName || ''
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    return (raw.full || raw.name || raw.displayName || '').toString().trim()
  }
  return raw?.toString?.().trim?.() || ''
}

function PlayerTile({
  player,
  isSelected,
  isBackup,
  lineupStatus = '',
  onToggle,
  onBackup,
  disabled = false,
  showBackupAction = false,
}) {
  const playedPreviousMatch = Boolean(player?.lastMatch?.played)
  const totalFantasyPoints = Number(player?.totalPoints || 0)
  const name = normalizePlayerName(player)
  const role = (player?.role || '').toString().trim() || 'BAT'
  const imageUrl = (player?.imageUrl || '').toString().trim()
  const isBackupAction = !isSelected && showBackupAction
  const actionLabel = isSelected ? '-' : isBackupAction ? (isBackup ? '–' : 'B') : '+'
  const actionTitle = isBackupAction
    ? isBackup
      ? 'Remove from backups'
      : 'Add to backups'
    : undefined
  const statusTitle =
    lineupStatus === 'playing'
      ? 'In announced playing XI'
      : lineupStatus === 'bench'
        ? 'Not in announced playing XI'
        : 'Played previous match'

  return (
    <div
      className={`player-tile ${playedPreviousMatch ? 'played-previous-match' : ''} ${isSelected ? 'selected' : ''} ${isBackup ? 'backup-selected' : ''} ${lineupStatus ? `lineup-${lineupStatus}` : ''}`.trim()}
    >
      <div className="player-tile-main">
        <PlayerRoleIcon role={role} className="player-tile-role-icon" />
        <span className="player-tile-avatar-wrap">
          <PlayerAvatar name={name} imageUrl={imageUrl} size="sm" />
          {(lineupStatus || playedPreviousMatch) && (
            <span
              className={`lineup-status-light ${lineupStatus || 'previous-played'}`.trim()}
              title={statusTitle}
              aria-label={statusTitle}
            />
          )}
        </span>
        <div className="player-tile-copy">
          <span className="player-tile-name">{name}</span>
        </div>
      </div>
      <div className="tile-actions">
        <button
          type="button"
          className={`tile-btn ${isBackupAction ? 'backup' : ''} ${isSelected || (isBackupAction && isBackup) ? 'is-active-remove' : ''}`.trim()}
          onClick={isBackupAction ? onBackup : onToggle}
          disabled={disabled}
          title={actionTitle}
        >
          <span className="tile-btn-label">{actionLabel}</span>
        </button>
        <span className="player-tile-total-points">{totalFantasyPoints}</span>
      </div>
    </div>
  )
}

export default PlayerTile
