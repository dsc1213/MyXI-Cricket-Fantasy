import PlayerIdentity from '../ui/PlayerIdentity.jsx'

function normalizePlayerName(player = {}) {
  const raw =
    player?.name || player?.playerName || player?.fullName || player?.displayName || ''
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    return (raw.full || raw.name || raw.displayName || '').toString().trim()
  }
  return raw?.toString?.().trim?.() || ''
}

function PlayerLabel({
  player,
  className = '',
  onClick = null,
  title = '',
  roleControls = null,
  lineupStatus = '',
  showTeam = false,
  subtitleSuffix = null,
}) {
  const name = normalizePlayerName(player)
  const role = (player.role || '').toString().trim() || 'BAT'
  const teamCode = (player.team || player.teamCode || '').toString().trim().toUpperCase()
  const imageUrl = (player.imageUrl || '').toString().trim()
  const badge = player.badge || ''
  const isInteractive = typeof onClick === 'function'
  const showRoleControls =
    roleControls &&
    (typeof roleControls.onCaptainClick === 'function' ||
      typeof roleControls.onViceCaptainClick === 'function')

  return (
    <div
      className={`player-chip slot-chip compact ${isInteractive ? 'clickable' : ''} ${className}`.trim()}
      onClick={onClick || undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      title={title || undefined}
    >
      {!!lineupStatus && (
        <span
          className={`lineup-status-light ${lineupStatus}`.trim()}
          title={
            lineupStatus === 'playing'
              ? 'In announced playing XI'
              : 'Not in announced playing XI'
          }
          aria-label={
            lineupStatus === 'playing'
              ? 'In announced playing XI'
              : 'Not in announced playing XI'
          }
        />
      )}
      <div className="player-chip-copy">
        <PlayerIdentity
          name={name}
          imageUrl={imageUrl}
          subtitle={role}
          subtitleSuffix={subtitleSuffix}
          className="dense player-chip-identity"
          nameSuffix={
            <>
              {showTeam && teamCode ? (
                <em className="player-team-tag">{` (${teamCode})`}</em>
              ) : null}
              {!!badge && <em className="player-badge">{badge}</em>}
            </>
          }
        />
      </div>
      {showRoleControls && (
        <div className="player-chip-role-controls">
          <button
            type="button"
            className={`player-role-btn captain-btn ${roleControls?.captainActive ? 'active' : ''}`.trim()}
            onClick={(event) => {
              event.stopPropagation()
              roleControls.onCaptainClick?.()
            }}
            aria-label={roleControls?.captainActive ? 'Captain selected' : 'Set captain'}
            title="Captain"
          >
            C
          </button>
          <button
            type="button"
            className={`player-role-btn vice-captain-btn ${roleControls?.viceCaptainActive ? 'active' : ''}`.trim()}
            onClick={(event) => {
              event.stopPropagation()
              roleControls.onViceCaptainClick?.()
            }}
            aria-label={
              roleControls?.viceCaptainActive
                ? 'Vice captain selected'
                : 'Set vice captain'
            }
            title="Vice Captain"
          >
            VC
          </button>
        </div>
      )}
    </div>
  )
}

export default PlayerLabel
